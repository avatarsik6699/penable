import type { MessageTypes } from "~/shared/lib/messages";
import type {
  BoardDocument,
  BoardCatalog,
  DocumentRepository,
} from "../../board-document.types";
import type { SerializedRecordCopy } from "../record-copies";
import type { JobRequest, TransferAck } from "./jobs-protocol";

export type DocumentRecords = Awaited<ReturnType<DocumentRepository["read"]>>;

export type SerializedDocumentRecords = {
  [Key in keyof DocumentRecords]: SerializedRecordCopy;
};

export type OwnedPreparedBoard = {
  id: string;
  records: DocumentRecords;
  document?: BoardDocument;
  error?: MessageTypes.Value;
  bootstrap: (catalog: BoardCatalog) => Promise<void>;
  close: () => Promise<void>;
};

export type StorageReadRequest =
  | TransferAck
  | { type: "load"; boardId: string }
  | { type: "bootstrap"; catalog: BoardCatalog }
  | { type: "close" };

export type StorageReadResponse =
  | JobRequest
  | { type: "records"; records: SerializedDocumentRecords }
  | { type: "storage-error"; error: MessageTypes.Value }
  | {
      type: "storage-complete";
      command: "bootstrap" | "close";
      error?: MessageTypes.Value;
    };
