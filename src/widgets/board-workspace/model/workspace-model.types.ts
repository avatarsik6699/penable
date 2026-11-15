import type { MessageTypes } from "~/shared/lib/messages";
import type {
  BoardItem,
  Viewport,
  SelectionShape,
  BackgroundSettings,
  WritingView,
} from "~/entities/board";

export type SelectionState = {
  insertion?: {
    phase: "idle" | "choosing" | "processing" | "success" | "error" | "placing";
    message: MessageTypes.Value;
  };
  images?: boolean;
  selected: boolean;
  clipboard: boolean;
  busy: boolean;
  message: MessageTypes.Value;
  png: boolean;
};

export type SelectionCommand =
  | "all"
  | "clear"
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "duplicate"
  | "download"
  | "crop";

export type InputDiagnostics = {
  pointerType: string | null;
  inputEvent: string | null;
  lastPenContact: string | null;
  pressure: number | null;
  active: boolean;
  dpr: number;
  coalesced: boolean;
  zoom: number;
  nativeScale: number;
  requestedRatio: number;
  effectiveRatio: number;
  bitmapWidth: number;
  bitmapHeight: number;
  resolutionCapped: boolean;
};

export type SurfaceControls = {
  transform?: (width: number, height: number, angle: number) => void;
  insertImage?: () => void;
  insertTemplate?: (
    config: import("~/entities/board").TemplateConfig,
    explicitSize?: boolean,
  ) => void;
  dismissInsertion?: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitAll: () => void;
  returnToWriting?: () => void;
  selection: (command: SelectionCommand) => void;
  selectionShape: (shape: SelectionShape) => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => {
    strokes: BoardItem[];
    viewport: Viewport;
  };
  isBusy: () => boolean;
  cancelInput: () => void;
};

import type {
  BoardSnapshot,
  BackgroundMode,
  DrawingTool,
  HistoryState,
} from "~/entities/board";
import type {
  BoardLibrarySession,
  LibraryState,
  DocumentSession,
  StorageState,
} from "~/features/board-document";

export type WorkspaceState = Readonly<{
  selectionShape: SelectionShape;
  selection: Readonly<SelectionState>;
  tool: DrawingTool;
  fingerInput: boolean;
  width: number;
  stabilization: number;
  writing: import("~/entities/board").WritingSettings;
  background: BackgroundMode;
  backgroundSettings: BackgroundSettings;
  lastWritingView: WritingView | null;
  history: Readonly<HistoryState>;
  storage: Readonly<StorageState>;
  diagnostics: Readonly<InputDiagnostics>;
  generation: number;
  hasBoard: boolean;
  hasInk: boolean;
  unavailable: MessageTypes.Value;
  dialogOpen: boolean;
  uiRevision: number;
  navigationMessage: MessageTypes.Value;
  library: LibraryState;
}>;

export type WorkspaceDependencies = {
  defaultBoardTitle?: string;
  diagnostics: InputDiagnostics;
  session: (options: {
    snapshot: () => BoardSnapshot;
    onHydrate: (board: BoardSnapshot) => void;
    onState: (state: StorageState) => void;
    onLibrary?: (state: LibraryState) => void;
  }) => DocumentSession | BoardLibrarySession;
  download: (
    json: import("~/features/board-document").DownloadContents,
    name: string,
  ) => void;
  exportDocument: (
    document: import("~/features/board-document").BoardDocument,
    signal: AbortSignal,
  ) => Promise<{
    contents: import("~/features/board-document").DownloadContents;
    warning: MessageTypes.Value;
  }>;
};
