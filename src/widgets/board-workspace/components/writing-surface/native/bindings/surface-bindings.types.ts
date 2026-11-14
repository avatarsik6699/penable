import type { SelectionCommand } from "../../../../model/workspace-model.types";
import {
  type BoardNavigation,
  type PenInput,
  type EraserInput,
  type BoardSelection,
  type DrawingTool,
  type Viewport,
  type HistoryAction,
} from "~/entities/board";
import type { SurfaceElements } from "../editor-runtime.types";

export type BindingOptions = {
  elements: SurfaceElements;
  canvas: HTMLCanvasElement;
  state: { viewport: Viewport };
  navigation: BoardNavigation;
  input: PenInput;
  eraser: EraserInput;
  selection: BoardSelection;
  getTool: () => DrawingTool;
  canWrite: () => boolean;
  interactionsBlocked: () => boolean;
  templatePlacement?: import("../templates").TemplatePlacement;
  cancelPendingInput?: () => boolean;
  drawingPointerId: () => number | null;
  activeInput: () => PenInput | EraserInput | BoardSelection;
  observeInput: (event?: PointerEvent) => void;
  publishHistoryState: () => void;
  selectionCommand: (command: SelectionCommand) => void;
  applyHistory: (action: HistoryAction) => void;
  paintSelection: () => void;
};

export type InteractionState = {
  spaceDown: boolean;
  focused: boolean;
  keyboardEntry: boolean;
};
