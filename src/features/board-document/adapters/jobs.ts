import type { RegionInput } from "~/entities/board";
import { DocumentCodec } from "../model/codec";
import { BoardRegions } from "~/entities/board";
import type { SelectedPart } from "~/entities/board";
import type { BoardDocument } from "../model/types";
import type { Stroke } from "~/entities/board";
import type {
  DocumentJobKind,
  JobResponse,
  SelectionResult,
  StrokeMetadata,
} from "./jobs-protocol";
// Internal application boundary: membership/viewport/tools are captured synchronously;
// completed points/profiles/masks must stay immutable throughout upload. Unknown JSON
// still enters through the strict codec; the worker strictly decodes every payload.
import type { DocumentPersistence } from "../model/types";

export type JobWorker = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;

type JobOptions = {
  worker?: () => JobWorker;
  yield?: () => Promise<void>;
  now?: () => number;
};

function abortError() {
  return new DOMException("Действие отменено.", "AbortError");
}

async function yieldTask(): Promise<void> {
  const scheduler = globalThis.scheduler;

  if (scheduler?.yield) await scheduler.yield();
  else await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function heavyDocument(
  strokes: readonly Stroke[],
  region?: RegionInput,
): boolean {
  if (
    strokes.length > 500 ||
    (region?.shape === "lasso" && region.points.length > 128)
  )
    return true;

  let points = 0,
    vertices = 0;

  for (const stroke of strokes) {
    points += stroke.points.length;
    vertices += stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0;

    if (points > 20000 || vertices > 512) return true;
  }

  return false;
}

// The application supplies only completed immutable sources. The scene array itself
// is mutable, so every job captures its membership/scalars before the first yield.
export class DocumentJobs implements DocumentPersistence {
  private worker: JobWorker | null = null;
  private sourceIDs = new WeakMap<Stroke["points"], number>();
  private known = new Set<number>();
  private nextSource = 0;
  private nextJob = 0;
  private pending: {
    id: number;
    resolve: (value: JobResponse) => void;
    reject: (error: unknown) => void;
    parts?: SelectionResult["parts"];
  } | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  private closing: Promise<void> | null = null;

  constructor(private readonly options: JobOptions = {}) {}

  private ensureWorker(): JobWorker {
    if (this.closed) throw new Error("Обработка документа закрыта.");

    if (this.worker) return this.worker;

    const worker = this.options.worker
      ? this.options.worker()
      : new Worker(new URL("./jobs-worker.ts", import.meta.url), {
          type: "module",
        });

    worker.onmessage = ({ data }: MessageEvent<JobResponse>) => {
      const task = this.pending;

      if (!task || task.id !== data.id) return;

      if (data.chunk) {
        task.parts ??= [];
        task.parts.push(...data.chunk);

        return;
      }

      this.pending = null;

      if (data.selection)
        data.selection.parts = task.parts ?? data.selection.parts;

      if (data.error) task.reject(new Error(data.error));
      else task.resolve(data);
    };

    worker.onerror = (event) => {
      event.preventDefault();

      this.reset(
        new Error(
          "Не удалось обработать документ в фоновом потоке. Данные в памяти сохранены.",
        ),
      );
    };

    worker.onmessageerror = () =>
      this.reset(new Error("Не удалось передать данные фоновому потоку."));

    this.worker = worker;

    return worker;
  }

  private reset(error: unknown) {
    this.worker?.terminate();
    this.worker = null;
    this.known.clear();
    this.sourceIDs = new WeakMap();
    this.nextSource = 0;

    const pending = this.pending;

    this.pending = null;
    pending?.reject(error);
  }

  private async execute(
    kind: DocumentJobKind,
    input: BoardDocument,
    region?: RegionInput,
    signal?: AbortSignal,
  ): Promise<JobResponse> {
    if (signal?.aborted) throw abortError();

    if (this.pending)
      throw new Error("Другая операция с документом ещё выполняется.");

    const document = {
      ...input,
      strokes: [...input.strokes],
      viewport: { ...input.viewport },
      tools: { ...input.tools },
    };

    const capturedRegion = region
      ? {
          shape: region.shape,
          points: region.points.map((point) => ({ ...point })),
        }
      : undefined;

    const worker = this.ensureWorker(),
      id = ++this.nextJob;

    let resolve!: (value: JobResponse) => void,
      reject!: (error: unknown) => void;

    const result = new Promise<JobResponse>((yes, no) => {
      resolve = yes;
      reject = no;
    });

    // Attach immediately: worker errors or cancellation may arrive while uploading.
    let resultError: unknown;

    void result.catch((error) => {
      resultError = error;
    });

    this.pending = { id, resolve, reject };

    const abort = () => {
      if (this.pending?.id === id) this.reset(abortError());
    };

    signal?.addEventListener("abort", abort, { once: true });

    const current = () => {
      if (signal?.aborted || this.pending?.id !== id) throw abortError();
    };

    const now = this.options.now ?? (() => performance.now()),
      yieldWork = this.options.yield ?? yieldTask;

    let budgetStart = now();

    const checkpoint = async () => {
      current();

      if (now() - budgetStart >= 4) {
        await yieldWork();
        current();
        budgetStart = now();
      }
    };

    try {
      const { strokes: _strokes, ...root } = document;

      worker.postMessage({
        type: "start",
        id,
        kind,
        root,
        ...(capturedRegion ? { region: capturedRegion } : {}),
      });

      const used = new Set<number>(),
        metadata: StrokeMetadata[] = [];

      let vertices = 0;

      const sendMetadata = () => {
        if (metadata.length) {
          worker.postMessage({
            type: "strokes",
            id,
            values: metadata.splice(0),
          });

          vertices = 0;
        }
      };

      for (const stroke of document.strokes) {
        current();

        let geometry = this.sourceIDs.get(stroke.points);

        if (!geometry) {
          geometry = ++this.nextSource;
          this.sourceIDs.set(stroke.points, geometry);
        }

        if (!this.known.has(geometry) && !used.has(geometry)) {
          for (let offset = 0; offset < stroke.points.length; offset += 2048) {
            const count = Math.min(2048, stroke.points.length - offset),
              values = new Float64Array(count * 4);

            for (let i = 0; i < count; i++) {
              const point = stroke.points[offset + i]!;

              values[i * 4] = point.x;
              values[i * 4 + 1] = point.y;
              values[i * 4 + 2] = point.pressure;
              values[i * 4 + 3] = point.time;
            }

            worker.postMessage(
              {
                type: "points",
                id,
                geometry,
                length: stroke.points.length,
                offset,
                values,
              },
              [values.buffer],
            );

            await checkpoint();
          }
        }

        used.add(geometry);

        const { points: _points, ...entry } = stroke;

        metadata.push({ ...entry, geometry });
        vertices += stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0;

        if (metadata.length >= 64 || vertices >= 2048) sendMetadata();

        await checkpoint();
      }

      sendMetadata();
      current();
      worker.postMessage({ type: "finish", id });

      const response = await result;

      this.known = used;

      return response;
    } catch (error) {
      if (this.pending?.id === id) this.reset(error);

      await result.catch(() => {});

      throw resultError ?? error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }

  select(
    strokes: readonly Stroke[],
    region: RegionInput,
    signal: AbortSignal,
  ): Promise<{
    region: SelectionResult["region"];
    parts: SelectedPart[];
  }> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    const originals = [...strokes];

    return this.execute(
      "select",
      { ...DocumentCodec.emptyDocument(), strokes: originals },
      region,
      signal,
    ).then((result) => {
      if (!result.selection)
        throw new Error("Фоновый поток не вернул выделение.");

      return {
        region: result.selection.region,
        parts: result.selection.parts.map((part) => {
          const original = originals[part.index]!;

          return {
            original,
            selected: part.same
              ? original
              : { ...part.selected, points: original.points },
            remainder: part.remainder
              ? { ...part.remainder, points: original.points }
              : null,
          };
        }),
      };
    });
  }

  validate(
    strokes: readonly Stroke[],
    signal: AbortSignal,
    root: BoardDocument = DocumentCodec.emptyDocument(),
  ): Promise<void> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    return this.execute(
      "validate",
      { ...root, strokes: [...strokes] },
      undefined,
      signal,
    ).then(() => {});
  }

  write(document: BoardDocument): Promise<void> {
    if (this.closing)
      return Promise.reject(new Error("Обработка документа закрывается."));

    const captured = {
      ...document,
      strokes: [...document.strokes],
      viewport: { ...document.viewport },
      tools: { ...document.tools },
    };

    const operation = this.tail.then(() => this.execute("save", captured));

    this.tail = operation.catch(() => {});

    return operation.then(() => {});
  }

  cancel() {
    this.reset(abortError());
  }

  close(): Promise<void> {
    this.closing ??= this.drainAndClose();

    return this.closing;
  }

  private async drainAndClose(): Promise<void> {
    await this.tail;

    if (this.pending) this.cancel();

    if (this.worker) {
      const worker = this.worker,
        id = ++this.nextJob;

      const complete = new Promise<JobResponse>((resolve, reject) => {
        this.pending = { id, resolve, reject };
      });

      worker.postMessage({ type: "close", id });

      try {
        await complete;
      } finally {
        worker.terminate();
        this.worker = null;
      }
    }

    this.closed = true;
    this.known.clear();
  }
}

export const DocumentWorkload = { heavyDocument };
