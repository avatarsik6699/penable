import { DocumentJobConfig } from "./document-jobs.config";
import type { RegionInput } from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";
import type {
  DocumentJobKind,
  JobResponse,
  SelectionResult,
} from "./jobs-protocol";
import type { JobOptions, JobWorker } from "./document-jobs.types";
import { SourceUpload } from "./source-upload";
import { JobScheduling } from "./job-scheduling";

export class JobTransport {
  private worker: JobWorker | null = null;
  private readonly upload = new SourceUpload();
  private nextJob = 0;
  private pending: {
    id: number;
    resolve: (value: JobResponse) => void;
    reject: (error: unknown) => void;
    parts?: SelectionResult["parts"];
  } | null = null;
  private closed = false;

  constructor(private readonly options: JobOptions) {}

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
    this.upload.reset();

    const pending = this.pending;

    this.pending = null;
    pending?.reject(error);
  }

  async execute(
    kind: DocumentJobKind,
    input: BoardDocument,
    region?: RegionInput,
    signal?: AbortSignal,
    fragmentRegion?: import("~/entities/board").ClipMask,
  ): Promise<JobResponse> {
    if (signal?.aborted) throw JobScheduling.abortError();

    if (this.pending)
      throw new Error("Другая операция с документом ещё выполняется.");

    const document = {
      ...input,
      strokes: [...input.strokes],
      viewport: { ...input.viewport },
      tools: { ...input.tools },
      backgroundSettings: {
        ...(input.backgroundSettings ?? { contrast: 45, spacing: 24 }),
      },
      lastWritingView: input.lastWritingView
        ? {
            center: { ...input.lastWritingView.center },
            zoom: input.lastWritingView.zoom,
          }
        : null,
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
      if (this.pending?.id === id) this.reset(JobScheduling.abortError());
    };

    signal?.addEventListener("abort", abort, { once: true });

    const current = () => {
      if (signal?.aborted || this.pending?.id !== id)
        throw JobScheduling.abortError();
    };

    const now = this.options.now ?? (() => performance.now()),
      yieldWork = this.options.yield ?? JobScheduling.yieldTask;

    let budgetStart = now();

    const checkpoint = async () => {
      current();

      if (now() - budgetStart >= DocumentJobConfig.budgetMilliseconds) {
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
        boardId: this.options.boardId ?? "main",
        ...(fragmentRegion ? { fragmentRegion } : {}),
        ...(capturedRegion ? { region: capturedRegion } : {}),
      });

      const used = await this.upload.send(
        document,
        worker,
        id,
        current,
        checkpoint,
        kind === "save" || kind === "validate" || kind === "fragment",
      );

      current();
      worker.postMessage({ type: "finish", id });

      const response = await result;

      this.upload.commit(used, document.strokes);

      return response;
    } catch (error) {
      if (this.pending?.id === id) this.reset(error);

      await result.catch(() => {});

      throw resultError ?? error;
    } finally {
      signal?.removeEventListener("abort", abort);
    }
  }

  cancel() {
    this.reset(JobScheduling.abortError());
  }

  async close() {
    if (this.pending) this.reset(JobScheduling.abortError());

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
    this.upload.reset();
  }
}
