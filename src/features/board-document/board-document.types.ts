import type { BackgroundMode } from "~/entities/board";
import type {
  Stroke,
  Viewport,
  BackgroundSettings,
  WritingView,
} from "~/entities/board";

export type BoardDocument = {
  format: "penable-board";
  schemaVersion: 1 | 2 | 3;
  strokes: Stroke[];
  viewport: Viewport;
  background: BackgroundMode;
  backgroundSettings?: BackgroundSettings;
  lastWritingView?: WritingView | null;
  tools: {
    width: number;
    stabilization: number;
  };
};

export type DocumentRepository = {
  read: () => Promise<{
    main: StoredRecord;
    beforeImport: StoredRecord;
    beforeSchema2?: StoredRecord;
    beforeSchema3?: StoredRecord;
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
  canReconnect: boolean;
  message: string;
};

export type DocumentPersistence = {
  write: (document: BoardDocument) => Promise<void>;
  close: () => Promise<void>;
};
