import { Messages } from "~/shared/lib/messages";
import { DocumentRepositoryAdapter } from "../../adapters/indexeddb";
import { LibraryRepositoryAdapter } from "../../adapters/library-indexeddb";
import { DocumentCodec, DocumentSchema } from "../codec";
import type {
  BoardDocument,
  DocumentRepository,
  LibraryRepository,
} from "../../board-document.types";
import { CreditWindow } from "./credit-window";
import { SourceUpload } from "./source-upload";
import { RecoveryCopy } from "./recovery-copy";
import type { SerializedRecordCopy } from "../record-copies";
import type {
  DocumentRecords,
  StorageReadRequest,
  StorageReadResponse,
  SerializedDocumentRecords,
} from "./document-storage.types";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<StorageReadRequest>) => void) | null;
  postMessage: (
    message: StorageReadResponse,
    transfer?: Transferable[],
  ) => void;
};

const credit = new CreditWindow();
const copies = new WeakMap<object, SerializedRecordCopy>();
let repository: DocumentRepository | null = null;
let library: LibraryRepository | null = null;
let records: DocumentRecords | null = null;
let document: BoardDocument | null = null;

function copy(
  record: import("../../board-document.types").StoredRecord,
): SerializedRecordCopy {
  const value = record.value;

  if (record.exists && value && typeof value === "object") {
    const cached = copies.get(value);

    if (cached) return cached;

    const serialized = RecoveryCopy.serialize(record);

    copies.set(value, serialized);

    return serialized;
  }

  return RecoveryCopy.serialize(record);
}

function publishRecords() {
  const serialized = Object.fromEntries(
    Object.entries(records!).map(([key, record]) => [key, copy(record)]),
  ) as SerializedDocumentRecords;

  host.postMessage({ type: "records", records: serialized });
}

async function load(boardId: string) {
  try {
    repository = await DocumentRepositoryAdapter.openRepository(
      (error) => host.postMessage({ type: "storage-error", error }),
      undefined,
      boardId,
    );

    records = await repository.read();
    publishRecords();

    document = records.main.exists
      ? DocumentCodec.decodeDocument(records.main.value)
      : DocumentCodec.emptyDocument();

    const { strokes: _strokes, ...root } = document;

    host.postMessage({ type: "start", id: 1, kind: "validate", root });

    await new SourceUpload().send(
      document,
      host,
      1,
      () => {},
      async () => {},
      true,
      credit,
    );

    host.postMessage({ type: "finish", id: 1 });
  } catch (error) {
    credit.fail(error);
    host.postMessage({ type: "storage-error", error: Messages.from(error) });
  }
}

async function bootstrap(
  catalog: import("../../board-document.types").BoardCatalog,
) {
  try {
    if (!document || !records)
      throw Messages.error(Messages.create("boardIsNotLoaded"));

    library = await LibraryRepositoryAdapter.open((error) =>
      host.postMessage({ type: "storage-error", error }),
    );

    const raw = records.main;

    const candidate = {
      ...document,
      schemaVersion: DocumentSchema.current(document.strokes),
    };

    await library.bootstrap(catalog, candidate, raw);

    if (raw.exists) {
      if (!records.beforeLibrary?.exists) records.beforeLibrary = raw;

      const backups = DocumentSchema.upgradeBackups(
        candidate.schemaVersion,
        raw,
      );

      if (backups.beforeSchema4 && !records.beforeSchema4?.exists)
        records.beforeSchema4 = raw;

      if (backups.beforeSchema5 && !records.beforeSchema5?.exists)
        records.beforeSchema5 = raw;

      if (backups.beforeSchema6 && !records.beforeSchema6?.exists)
        records.beforeSchema6 = raw;
    }

    records.main = {
      exists: true,
      value: DocumentCodec.encodeDocument(candidate),
    };

    publishRecords();
    host.postMessage({ type: "storage-complete", command: "bootstrap" });
  } catch (error) {
    host.postMessage({
      type: "storage-complete",
      command: "bootstrap",
      error: Messages.from(error),
    });
  }
}

host.onmessage = ({ data }) => {
  if (data.type === "ack") {
    try {
      credit.acknowledge(data.seq);
    } catch (error) {
      credit.fail(error);
      host.postMessage({ type: "storage-error", error: Messages.from(error) });
    }
  }

  if (data.type === "load") void load(data.boardId);

  if (data.type === "bootstrap") void bootstrap(data.catalog);

  if (data.type === "close")
    void (async () => {
      try {
        await repository?.close();
        await library?.close();
        records = null;
        document = null;
        host.postMessage({ type: "storage-complete", command: "close" });
      } catch (error) {
        host.postMessage({
          type: "storage-complete",
          command: "close",
          error: Messages.from(error),
        });
      }
    })();
};
