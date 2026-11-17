import type { MessageTypes } from "~/shared/lib/messages";
import type {
  InputDiagnostics,
  SelectionState,
  SurfaceControls,
} from "../../model/workspace-model.types";
import type { RefObject } from "react";
import type {
  BackgroundMode,
  BackgroundSettings,
  WritingView,
  BoardSnapshot,
  DrawingTool,
  HistoryState,
  SelectionClipboard,
} from "~/entities/board";

export namespace WritingSurfaceTypes {
  export type Props = {
    theme?: import("~/shared/lib/theme").ThemeTypes.Effective;
    clipboard: SelectionClipboard;
    tool: DrawingTool;
    onActivateSelection: () => void;
    onSelectionState: (state: SelectionState) => void;
    getTool: () => DrawingTool;
    getFingerInput?: () => boolean;
    width: number;
    writing?: import("~/entities/board").WritingSettings;
    stabilization: number;
    background: BackgroundMode;
    backgroundSettings: BackgroundSettings;
    lastWritingView: WritingView | null;
    onNavigationNotice: (message: MessageTypes.Value) => void;
    onScenePresence: (hasInk: boolean) => void;
    onWritingCommitted: (view: WritingView) => void;
    minimapOpen: boolean;
    onMinimapClose: () => void;
    bindMinimapRoot: (
      node: import("~/shared/lib/overlay").OverlayElements.Container | null,
    ) => void;
    initialDocument: BoardSnapshot;
    canWrite: () => boolean;
    modalOpen: boolean;
    uiRevision: number;
    interactionsBlocked: () => boolean;
    onDocumentChange: (urgent: boolean) => void;
    onHistoryState: (state: HistoryState) => void;
    onDiagnostics: (value: InputDiagnostics) => void;
    onUnavailable: (reason: MessageTypes.Value) => void;
    controlsRef: RefObject<SurfaceControls | null>;
  };
}
