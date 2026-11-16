import { DocumentCapture } from "./document-capture";
import { Messages } from "~/shared/lib/messages";
import { DocumentJobConfig } from "./document-jobs.config";
import type { RegionInput } from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";
import type {
  DocumentJobKind,
  JobResponse,
  SelectionResult,
} from "./jobs-protocol";
import type { JobOptions, JobWorker } from "./document-jobs.types";
import { CreditWindow } from "./credit-window";
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
  private credit: CreditWindow | null = null;

  constructor(private readonly options: JobOptions) {}

  private ensureWorker(): JobWorker {
    if (this.closed)
      throw Messages.error(Messages.create("documentProcessingIsClosed"));

    if (this.worker) return this.worker;

    const worker = this.options.worker
      ? this.options.worker()
      : new Worker(new URL("./jobs-worker.ts", import.meta.url), {
          type: "module",
        });

    worker.onmessage = ({ data }: MessageEvent<JobResponse>) => {
      const task = this.pending;

      if (!task || task.id !== data.id) return;

      if (data.ack !== undefined) {
        try {
          this.credit?.acknowledge(data.ack);
        } catch (error) {
          this.reset(error);
        }

        return;
      }

      if (data.error) {
        this.reset(Messages.error(data.error));

        return;
      }

      if (data.chunk) {
        try {
          task.parts ??= [];
          task.parts.push(...data.chunk);
          worker.postMessage({ type: "ack", id: data.id, seq: data.seq! });
        } catch (error) {
          this.reset(error);
        }

        return;
      }

      this.pending = null;

      if (data.selection)
        data.selection.parts = task.parts ?? data.selection.parts;

      task.resolve(data);
    };

    worker.onerror = (event) => {
      event.preventDefault();

      this.reset(
        Messages.error(Messages.create("couldNotProcessTheDocumentInThe")),
      );
    };

    worker.onmessageerror = () =>
      this.reset(
        Messages.error(Messages.create("couldNotSendDataToTheBackground")),
      );

    this.worker = worker;

    return worker;
  }

  private reset(error: unknown) {
    this.credit?.fail(error);
    this.credit = null;
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
    previous?: import("../../board-document.types").ReplacementPrevious,
    trustedReplacement = false,
  ): Promise<JobResponse> {
    if (signal?.aborted) throw JobScheduling.abortError();

    if (this.pending)
      throw Messages.error(
        Messages.create("anotherDocumentOperationIsStillRunning"),
      );

    const document = DocumentCapture.completed(input);

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
    this.credit = new CreditWindow();

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
      const before = previous && !("kind" in previous) ? previous : null;

      if (kind === "replace") this.upload.reset();

      const { strokes: _strokes, ...root } = before ?? document;

      worker.postMessage({
        type: "start",
        id,
        kind,
        root,
        ...(kind === "replace"
          ? { previousStored: !before, trustedReplacement }
          : {}),
        boardId: this.options.boardId ?? "main",
        ...(fragmentRegion ? { fragmentRegion } : {}),
        ...(capturedRegion ? { region: capturedRegion } : {}),
      });

      if (before) {
        await this.upload.send(
          before,
          worker,
          id,
          current,
          checkpoint,
          true,
          this.credit!,
        );

        current();

        const { strokes: _items, ...candidateRoot } = document;

        worker.postMessage({
          type: "replacement-candidate",
          id,
          root: candidateRoot,
        });

        this.upload.reset();
      }

      const used = await this.upload.send(
        document,
        worker,
        id,
        current,
        checkpoint,
        kind === "replace" ||
          kind === "save" ||
          kind === "validate" ||
          kind === "fragment" ||
          kind === "export" ||
          kind === "raw-export",
        this.credit!,
      );

      current();
      worker.postMessage({ type: "finish", id });

      const response = await result;

      if (this.worker === worker) this.upload.commit(used, document.strokes);

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

    this.closed = true;

    try {
      if (this.worker) {
        const worker = this.worker,
          id = ++this.nextJob;

        const complete = new Promise<JobResponse>((resolve, reject) => {
          this.pending = { id, resolve, reject };
        });

        void complete.catch(() => {});

        try {
          worker.postMessage({ type: "close", id });
          await complete;
        } catch (error) {
          this.reset(error);
          await complete.catch(() => {});

          throw error;
        } finally {
          if (this.worker === worker) worker.terminate();

          this.worker = null;
          this.pending = null;
        }
      }
    } finally {
      this.credit?.fail(JobScheduling.abortError());
      this.credit = null;
      this.upload.reset();
    }
  }
}
