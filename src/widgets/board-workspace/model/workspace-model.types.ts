import type {
  BoardItem,
  Viewport,
  SelectionShape,
  BackgroundSettings,
  WritingView,
} from "~/entities/board";

export type SelectionState = {
  images?: boolean;
  selected: boolean;
  clipboard: boolean;
  busy: boolean;
  message: string;
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
  | "image"
  | "download"
  | "crop"
  | "paste-image";

export type InputDiagnostics = {
  pointerType: string | null;
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
  width: number;
  stabilization: number;
  background: BackgroundMode;
  backgroundSettings: BackgroundSettings;
  lastWritingView: WritingView | null;
  history: Readonly<HistoryState>;
  storage: Readonly<StorageState>;
  diagnostics: Readonly<InputDiagnostics>;
  generation: number;
  hasBoard: boolean;
  hasInk: boolean;
  unavailable: string;
  dialogOpen: boolean;
  uiRevision: number;
  navigationMessage: string;
  library: LibraryState;
}>;

export type WorkspaceDependencies = {
  diagnostics: InputDiagnostics;
  session: (options: {
    snapshot: () => BoardSnapshot;
    onHydrate: (board: BoardSnapshot) => void;
    onState: (state: StorageState) => void;
    onLibrary?: (state: LibraryState) => void;
  }) => DocumentSession | BoardLibrarySession;
  download: (json: string, name: string) => void;
};
