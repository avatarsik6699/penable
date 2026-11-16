import { ImportCandidates, type ImportCandidate } from "../import-candidates";
import { CreditWindow } from "./credit-window";
import { OwnedRecordTransfer } from "./owned-record-transfer";
import { Messages } from "~/shared/lib/messages";
import { DocumentCodec } from "../codec";
import type { BoardDocument } from "../../board-document.types";
import type { JobWorker } from "./document-jobs.types";
import { JobScheduling } from "./job-scheduling";
import { DocumentReadBuffer } from "./document-read-buffer";
import type {
  DocumentReadResponse,
  DocumentReadRequest,
} from "./document-reader.types";

function requestDocument(
  request: DocumentReadRequest,
  signal: AbortSignal,
  factory?: () => JobWorker,
  owned?: unknown,
): Promise<BoardDocument> {
  if (signal.aborted) return Promise.reject(JobScheduling.abortError());

  return new Promise((resolve, reject) => {
    const worker = factory
        ? factory()
        : new Worker(new URL("./document-reader-worker.ts", import.meta.url), {
            type: "module",
          }),
      buffer = new DocumentReadBuffer(),
      credit = new CreditWindow();

    let settled = false;

    const finish = (error?: unknown, document?: BoardDocument) => {
      if (settled) return;

      settled = true;

      if (error) credit.fail(error);

      signal.removeEventListener("abort", abort);
      worker.terminate();

      if (document) resolve(document);
      else reject(error);
    };

    const abort = () => finish(JobScheduling.abortError());

    signal.addEventListener("abort", abort, { once: true });

    worker.onerror = (event) => {
      event.preventDefault();
      finish(Messages.error(Messages.create("documentProcessingFailed")));
    };

    worker.onmessageerror = () =>
      finish(
        Messages.error(Messages.create("couldNotSendDataToTheBackground")),
      );

    worker.onmessage = ({ data }: MessageEvent<DocumentReadResponse>) => {
      if (settled || signal.aborted) return;

      if (data.type === "error") {
        finish(Messages.error(data.message));

        return;
      }

      try {
        if (data.type === "ack") {
          credit.acknowledge(data.seq);

          return;
        }

        const document = buffer.accept(data);

        if ("seq" in data)
          worker.postMessage({ type: "ack", id: data.id, seq: data.seq });

        if (document) finish(undefined, document);
      } catch (error) {
        finish(error);
      }
    };

    try {
      if (owned !== undefined) {
        let budgetStart = performance.now();

        void OwnedRecordTransfer.send(
          owned,
          credit,
          (packet) => worker.postMessage(packet),
          async () => {
            if (signal.aborted || settled) throw JobScheduling.abortError();

            if (performance.now() - budgetStart >= 4) {
              await JobScheduling.yieldTask();
              budgetStart = performance.now();
            }
          },
        ).catch((error) => finish(error));
      } else worker.postMessage(request);
    } catch (error) {
      finish(error);
    }
  });
}

export const DocumentReader = {
  async readCandidate(
    blob: Blob,
    signal: AbortSignal,
    factory?: () => JobWorker,
  ): Promise<ImportCandidate> {
    const document = await DocumentReader.read(blob, signal, factory);

    if (signal.aborted) throw JobScheduling.abortError();

    return ImportCandidates.capture(document);
  },

  disposeCandidate: ImportCandidates.dispose,

  read(blob: Blob, signal: AbortSignal, factory?: () => JobWorker) {
    if (blob.size > DocumentCodec.DOCUMENT_LIMITS.bytes)
      return Promise.reject(
        Messages.error(Messages.create("fileExceeds64Mib")),
      );

    return requestDocument({ type: "file", blob }, signal, factory);
  },

  decode(value: unknown, signal: AbortSignal) {
    if (signal.aborted) return Promise.reject(JobScheduling.abortError());

    let captured: unknown;

    try {
      captured = structuredClone(value);
    } catch (error) {
      return Promise.reject(error);
    }

    return requestDocument({ type: "stored", value: captured }, signal).catch(
      (error) => {
        if (
          signal.aborted ||
          (error instanceof Error && error.name === "AbortError")
        )
          throw error;

        // Startup must retain the independent recovery path when Worker assets are
        // unavailable. Stored records still pass through the same strict decoder.
        return DocumentCodec.decodeDocument(captured);
      },
    );
  },

  // Only storage-owned detached records may use this path. Caller must retain immutability until completion.
  decodeOwned(value: unknown, signal: AbortSignal) {
    return requestDocument(
      { type: "stored", value: undefined },
      signal,
      undefined,
      value,
    ).catch((error) => {
      if (
        signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;

      return DocumentCodec.decodeDocument(value);
    });
  },

  prepare(value: BoardDocument, signal: AbortSignal) {
    return requestDocument({ type: "runtime", value }, signal);
  },
};
