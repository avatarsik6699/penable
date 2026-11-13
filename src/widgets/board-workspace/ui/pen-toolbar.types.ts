import type { InputDiagnostics } from "../model/types";
import type { DrawingTool, HistoryState } from "~/entities/board";
import type { BackgroundMode } from "~/entities/board";

export namespace PenToolbarTypes {
  export type Props = {
    tool: DrawingTool;
    onToolChange: (tool: DrawingTool) => void;
    width: number;
    onWidthChange: (width: number) => void;
    diagnostics: InputDiagnostics;
    stabilization: number;
    onStabilizationChange: (strength: number) => void;
    background: BackgroundMode;
    onBackgroundChange: (mode: BackgroundMode) => void;
    historyState: HistoryState;
    onUndo: () => void;
    onRedo: () => void;
    readOnly: boolean;
    onZoomIn: () => void;
    onZoomOut: () => void;
    onFitAll: () => void;
    selectionDisabled: boolean;
    onResetView: () => void;
  };
}
