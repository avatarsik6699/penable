import type { MessageTypes } from "~/shared/lib/messages";
import type { BoardSnapshot } from "~/entities/board";
import type {
  DocumentPersistence,
  DocumentRepository,
  StorageState,
  WriterLease,
} from "../../board-document.types";

export type SessionOptions = {
  snapshot: () => BoardSnapshot;
  decode?: (
    value: unknown,
    signal: AbortSignal,
  ) => Promise<import("../../board-document.types").BoardDocument>;
  prepare?: (
    value: import("../../board-document.types").BoardDocument,
    signal: AbortSignal,
  ) => Promise<import("../../board-document.types").BoardDocument>;
  preflight?: (
    document: import("../../board-document.types").BoardDocument,
    signal: AbortSignal,
  ) => Promise<void>;
  // Internal completed-source contract; injected/default adapters retain strict synchronous detachment.
  persistence?: DocumentPersistence;
  onHydrate: (document: BoardSnapshot) => void;
  onState: (state: StorageState) => void;
  acquire: () => Promise<WriterLease>;
  open: (
    invalidated: (message: MessageTypes.Value) => void,
  ) => Promise<DocumentRepository>;
};
