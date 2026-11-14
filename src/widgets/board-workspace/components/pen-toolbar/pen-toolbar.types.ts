import type React from "react";
import type { DrawingTool, HistoryState } from "~/entities/board";

export namespace PenToolbarTypes {
  export type Props = {
    insertion?: import("../../model/workspace-model.types").SelectionState["insertion"];
    leadingControls: React.ReactNode;
    onInsertImage: () => void;
    onDismissInsertion: () => void;
    tool: DrawingTool;
    onToolChange: (tool: DrawingTool) => void;
    width: number;
    writing: import("~/entities/board").WritingSettings;
    onInstrumentChange: (
      instrument: import("~/entities/board").InkInstrument,
    ) => void;
    onInkSettingsChange: (
      patch: Partial<import("~/entities/board").InstrumentSettings>,
    ) => void;
    templatesOpen: boolean;
    onTemplatesOpenChange: (open: boolean) => void;
    onInsertTemplate: (
      config: import("~/entities/board").TemplateConfig,
      explicitSize?: boolean,
    ) => void;
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
    selectionMessage: string;
    selectionOpen: boolean;
    selectionControls: React.ReactNode;
    trailingControls: React.ReactNode;
  };
}
