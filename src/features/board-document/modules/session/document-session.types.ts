import type { BoardSnapshot } from "~/entities/board";
import type {
  DocumentPersistence,
  DocumentRepository,
  StorageState,
  WriterLease,
} from "../../board-document.types";

export type SessionOptions = {
  snapshot: () => BoardSnapshot;
  // Internal completed-source contract; injected/default adapters retain strict synchronous detachment.
  persistence?: DocumentPersistence;
  onHydrate: (document: BoardSnapshot) => void;
  onState: (state: StorageState) => void;
  acquire: () => Promise<WriterLease>;
  open: (invalidated: (message: string) => void) => Promise<DocumentRepository>;
};
