import { Messages } from "~/shared/lib/messages";
import { RecordCopies } from "../record-copies";
import { DocumentReadBuffer } from "./document-read-buffer";
import { JobScheduling } from "./job-scheduling";
import type { JobWorker } from "./document-jobs.types";
import type {
  OwnedPreparedBoard,
  StorageReadRequest,
  StorageReadResponse,
  DocumentRecords,
} from "./document-storage.types";

function load(
  id: string,
  signal: AbortSignal,
  factory?: () => JobWorker,
): Promise<OwnedPreparedBoard> {
  if (signal.aborted) return Promise.reject(JobScheduling.abortError());

  return new Promise((resolve, reject) => {
    let worker: JobWorker | null = factory
      ? factory()
      : new Worker(new URL("./document-storage-worker.ts", import.meta.url), {
          type: "module",
        });

    let buffer: DocumentReadBuffer | null = new DocumentReadBuffer();

    const terminate = () => {
      const current = worker;

      worker = null;

      if (current) {
        current.onmessage = null;
        current.onerror = null;
        current.onmessageerror = null;
        current.terminate();
      }
    };

    let settled = false,
      failed = false,
      dead = false,
      closed: Promise<void> | null = null;

    let command: {
      kind: StorageReadRequest["type"];
      resolve: () => void;
      reject: (error: unknown) => void;
    } | null = null;

    let records: DocumentRecords | null = null;
    let prepared: OwnedPreparedBoard | null = null;
    let tail: Promise<unknown> = Promise.resolve();

    const finish = (
      error?: unknown,
      document?: import("../../board-document.types").BoardDocument,
    ) => {
      if (settled) return;

      settled = true;
      buffer = null;
      signal.removeEventListener("abort", abort);

      if (!records) {
        terminate();
        reject(error);

        return;
      }

      prepared = {
        id,
        records,
        ...(document ? { document } : {}),
        ...(error ? { error: Messages.from(error) } : {}),
        bootstrap: (catalog) => run({ type: "bootstrap", catalog }),

        close: () => {
          closed ??= (async () => {
            try {
              if (!dead) await run({ type: "close" });
            } finally {
              terminate();
              prepared = null;
              records = null;
            }
          })();

          return closed;
        },
      };

      resolve(prepared);
    };

    const failure = (error: unknown, transportDead = false) => {
      failed = true;
      dead ||= transportDead;
      command?.reject(error);
      command = null;

      if (!settled) finish(error);
    };

    const abort = () => {
      failed = true;
      terminate();

      if (!settled) {
        settled = true;
        signal.removeEventListener("abort", abort);
        reject(JobScheduling.abortError());
      }
    };

    const run = (request: StorageReadRequest): Promise<void> => {
      if (closed && request.type !== "close")
        return Promise.reject(
          Messages.error(Messages.create("documentProcessingIsClosed")),
        );

      const operation = tail.then(() => {
        if (dead || (failed && request.type !== "close"))
          throw Messages.error(Messages.create("documentProcessingFailed"));

        return new Promise<void>((yes, no) => {
          command = { kind: request.type, resolve: yes, reject: no };

          try {
            worker!.postMessage(request);
          } catch (error) {
            failure(error);
          }
        });
      });

      tail = operation.catch(() => {});

      return operation;
    };

    worker.onmessage = ({ data }: MessageEvent<StorageReadResponse>) => {
      try {
        if (data.type === "records") {
          records = Object.fromEntries(
            Object.entries(data.records).map(([key, record]) => [
              key,
              RecordCopies.capture(record),
            ]),
          ) as DocumentRecords;

          if (prepared) prepared.records = records;

          return;
        }

        if (data.type === "storage-error") {
          failure(Messages.error(data.error));

          return;
        }

        if (data.type === "storage-complete") {
          const pending = command;

          if (pending?.kind !== data.command) return;

          command = null;

          if (data.error) pending?.reject(Messages.error(data.error));
          else pending?.resolve();

          return;
        }

        if (settled) return;

        const document = buffer!.accept(data);

        if ("seq" in data)
          worker!.postMessage({ type: "ack", id: data.id, seq: data.seq });

        if (document) finish(undefined, document);
      } catch (error) {
        failure(error);
      }
    };

    worker.onerror = (event) => {
      event.preventDefault();

      failure(
        Messages.error(Messages.create("documentProcessingFailed")),
        true,
      );
    };

    worker.onmessageerror = () =>
      failure(
        Messages.error(Messages.create("couldNotSendDataToTheBackground")),
        true,
      );

    signal.addEventListener("abort", abort, { once: true });

    try {
      worker.postMessage({ type: "load", boardId: id });
    } catch (error) {
      failure(error);
    }
  });
}

export const DocumentStorage = { load };
