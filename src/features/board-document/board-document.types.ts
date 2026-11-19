import type { MessageTypes } from "~/shared/lib/messages";
import type { BackgroundMode } from "~/entities/board";
import type {
  BoardItem,
  Viewport,
  BackgroundSettings,
  WritingView,
} from "~/entities/board";

export type BoardDocument = {
  format: "penable-board";
  schemaVersion: 1 | 2 | 3 | 4 | 5 | 6;
  strokes: BoardItem[];
  viewport: Viewport;
  background: BackgroundMode;
  backgroundSettings?: BackgroundSettings;
  lastWritingView?: WritingView | null;
  tools: {
    width: number;
    stabilization: number;
    writing?: import("~/entities/board").WritingSettings;
  };
};

export type BoardColor =
  "blue" | "teal" | "green" | "amber" | "orange" | "red" | "violet" | "pink";

export type BoardIcon =
  | "notebook"
  | "book"
  | "calculator"
  | "languages"
  | "flask"
  | "atom"
  | "code"
  | "briefcase"
  | "lightbulb"
  | "music"
  | "palette"
  | "globe"
  | "calendar"
  | "folder"
  | "graduation"
  | "pen";

export type BoardAppearance = Readonly<{
  color: BoardColor;
  icon: BoardIcon;
}>;

export type BoardCatalog = {
  format: "penable-library";
  schemaVersion: 2;
  activeId: string;
  boards: Array<{
    id: string;
    title: string;
    appearance: BoardAppearance;
  }>;
};

export type LibraryRepository = {
  readCatalog?: () => Promise<StoredRecord>;
  read: () => Promise<{
    catalog: StoredRecord;
    main: StoredRecord;
  }>;
  board: (id: string) => Promise<StoredRecord>;
  bootstrap: (
    catalog: BoardCatalog,
    document: BoardDocument,
    raw: StoredRecord,
  ) => Promise<void>;
  migrate: (catalog: BoardCatalog, raw: StoredRecord) => Promise<void>;
  update: (
    catalog: BoardCatalog,
    change?: {
      create?: {
        id: string;
        document: BoardDocument;
      };
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
    beforeSchema5?: StoredRecord;
    beforeSchema6?: StoredRecord;
    beforeLibrary?: StoredRecord;
  }>;
  write: (document: BoardDocument) => Promise<StoredRecord | void>;
  replace: (
    previous: unknown,
    candidate: BoardDocument,
  ) => Promise<StoredRecord | void>;
  replaceStored?: (candidate: BoardDocument) => Promise<StoredRecord | void>;
  close: () => Promise<void>;
};

export type StoredRecord = {
  exists: boolean;
  value: unknown;
};

export type WriterLease = {
  acquired: boolean;
  message: MessageTypes.Value;
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
  hasSchema5Copy?: boolean;
  hasSchema6Copy?: boolean;
  hasLibraryCopy?: boolean;
  hasRawCopy?: boolean;
  canReconnect: boolean;
  message: MessageTypes.Value;
};

export type ReplacementPrevious = BoardDocument | { kind: "stored-current" };

// Internal completed-source port: replacement candidates have passed strict Session preparation.
export type DocumentPersistence = {
  replace?: (
    previous: ReplacementPrevious,
    candidate: BoardDocument,
    onSchema6Copy?: (record: StoredRecord) => void,
  ) => Promise<StoredRecord | void>;
  write: (document: BoardDocument) => Promise<StoredRecord | void>;
  close: () => Promise<void>;
};
