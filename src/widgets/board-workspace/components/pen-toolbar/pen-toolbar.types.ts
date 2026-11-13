import type React from "react";
import type { DrawingTool, HistoryState } from "~/entities/board";

export namespace PenToolbarTypes {
  export type Props = {
    leadingControls: React.ReactNode;
    onInsertImage: () => void;
    tool: DrawingTool;
    onToolChange: (tool: DrawingTool) => void;
    width: number;
    onWidthChange: (width: number) => void;
    stabilization: number;
    onStabilizationChange: (strength: number) => void;
    historyState: HistoryState;
    onUndo: () => void;
    onRedo: () => void;
    readOnly: boolean;
    selectionDisabled: boolean;
    penOpen: boolean;
    onPenOpenChange: (open: boolean) => void;
    selectionControls: React.ReactNode;
    trailingControls: React.ReactNode;
  };
}
