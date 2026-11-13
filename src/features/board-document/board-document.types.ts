import type { BackgroundMode } from "~/entities/board";
import type {
  BoardItem,
  Viewport,
  BackgroundSettings,
  WritingView,
} from "~/entities/board";

export type BoardDocument = {
  format: "penable-board";
  schemaVersion: 1 | 2 | 3 | 4;
  strokes: BoardItem[];
  viewport: Viewport;
  background: BackgroundMode;
  backgroundSettings?: BackgroundSettings;
  lastWritingView?: WritingView | null;
  tools: {
    width: number;
    stabilization: number;
  };
};

export type BoardCatalog = {
  format: "penable-library";
  schemaVersion: 1;
  activeId: string;
  boards: Array<{ id: string; title: string }>;
};

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

export type DocumentRepository = {
  read: () => Promise<{
    main: StoredRecord;
    beforeImport: StoredRecord;
    beforeSchema2?: StoredRecord;
    beforeSchema3?: StoredRecord;
    beforeSchema4?: StoredRecord;
    beforeLibrary?: StoredRecord;
  }>;
  write: (document: BoardDocument) => Promise<void>;
  replace: (previous: unknown, candidate: BoardDocument) => Promise<void>;
  close: () => Promise<void>;
};

export type StoredRecord = {
  exists: boolean;
  value: unknown;
};

export type WriterLease = {
  acquired: boolean;
  message: string;
  release: () => Promise<void>;
};

export type SavePhase = "loading" | "dirty" | "saving" | "saved" | "error";

export type StorageState = {
  phase: SavePhase;
  loaded: boolean;
  writable: boolean;
  readOnly: boolean;
  canImport: boolean;
  importing: boolean;
  hasPrevious: boolean;
  hasUpgradeCopy?: boolean;
  hasSchema3Copy?: boolean;
  hasSchema4Copy?: boolean;
  hasLibraryCopy?: boolean;
  hasRawCopy?: boolean;
  canReconnect: boolean;
  message: string;
};

export type DocumentPersistence = {
  write: (document: BoardDocument) => Promise<void>;
  close: () => Promise<void>;
};
