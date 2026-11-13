import type {
  InputDiagnostics,
  SelectionState,
  SurfaceControls,
} from "../../model/workspace-model.types";
import type { RefObject } from "react";
import type {
  BackgroundMode,
  BoardSnapshot,
  DrawingTool,
  HistoryState,
  SelectionClipboard,
} from "~/entities/board";

export namespace WritingSurfaceTypes {
  export type Props = {
    clipboard: SelectionClipboard;
    tool: DrawingTool;
    onActivateSelection: () => void;
    onSelectionState: (state: SelectionState) => void;
    getTool: () => DrawingTool;
    width: number;
    stabilization: number;
    background: BackgroundMode;
    initialDocument: BoardSnapshot;
    canWrite: () => boolean;
    modalOpen: boolean;
    uiRevision: number;
    interactionsBlocked: () => boolean;
    onDocumentChange: (urgent: boolean) => void;
    onHistoryState: (state: HistoryState) => void;
    onDiagnostics: (value: InputDiagnostics) => void;
    onUnavailable: (reason: string) => void;
    controlsRef: RefObject<SurfaceControls | null>;
  };
}
