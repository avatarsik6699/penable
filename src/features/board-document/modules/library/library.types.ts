import type {
  BoardDocument,
  StoredRecord,
  WriterLease,
} from "../../board-document.types";
import type { SessionOptions, DocumentSession } from "../session";

export type BoardCatalog = {
  format: "penable-library";
  schemaVersion: 1;
  activeId: string;
  boards: Array<{ id: string; title: string }>;
};

export type LibraryState = Readonly<{
  activeId: string;
  boards: ReadonlyArray<Readonly<{ id: string; title: string }>>;
  busy: boolean;
  message: string;
}>;

export type LibraryRepository = {
  read: () => Promise<{ catalog: StoredRecord; main: StoredRecord }>;
  board: (id: string) => Promise<StoredRecord>;
  bootstrap: (
    catalog: BoardCatalog,
    document: BoardDocument,
    raw: StoredRecord,
  ) => Promise<void>;
  update: (
    catalog: BoardCatalog,
    change?: {
      create?: { id: string; document: BoardDocument };
      remove?: string;
    },
  ) => Promise<void>;
  close: () => Promise<void>;
};

export type LibraryOptions = Pick<
  SessionOptions,
  "snapshot" | "onHydrate" | "onState"
> & {
  onLibrary?: (state: LibraryState) => void;
  preflight?: (document: BoardDocument, signal: AbortSignal) => Promise<void>;
  acquire: () => Promise<WriterLease>;
  open: (invalidated: (message: string) => void) => Promise<LibraryRepository>;
  session: (
    id: string,
    lease: WriterLease,
    options: Pick<SessionOptions, "snapshot" | "onHydrate" | "onState">,
  ) => DocumentSession;
  id: () => string;
};
