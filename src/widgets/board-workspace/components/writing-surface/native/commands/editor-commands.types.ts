import type {
  BoardSelection,
  PenInput,
  EraserInput,
  BoardNavigation,
  StrokeHistory,
  Scene,
  Viewport,
  WritingView,
  HistoryState,
  HistoryAction,
} from "~/entities/board";
import type { SelectionCommand } from "../../../../model/workspace-model.types";
import type { CanvasRenderer } from "../rendering";
import type { EditorHandle } from "../editor-runtime.types";
import type { SurfaceBindings } from "../bindings";

export namespace EditorCommandTypes {
  type Interaction = {
    selection: BoardSelection;
    navigation: BoardNavigation;
    drawingPointerId: () => number | null;
    interactionsBlocked: () => boolean;
  };

  export type SelectionOptions = Omit<Interaction, "drawingPointerId"> & {
    pendingInput?: () => boolean;
    clipboard: import("../clipboard").BoardClipboard;
    images?: import("../images").BitmapCache;
    input: PenInput;
    eraser: EraserInput;
    cancel: () => void;
    onActivateSelection: () => void;
    publishSelection: () => void;
  };

  export type HistoryOptions = Interaction & {
    additionalBusy?: () => boolean;
    history: StrokeHistory;
    canWrite: () => boolean;
    renderer: CanvasRenderer;
    onDocumentChange: (urgent: boolean) => void;
    onHistoryState: (state: HistoryState) => void;
    active: () => boolean;
  };

  export type ControlsOptions = Interaction & {
    pendingInput?: () => boolean;
    insertImage: () => void;
    insertTemplate?: (
      config: import("~/entities/board").TemplateConfig,
      explicitSize?: boolean,
    ) => void;
    dismissInsertion: () => void;
    canvas: HTMLCanvasElement;
    scene: Scene;
    state: { viewport: Viewport };
    selectionCommand: (command: SelectionCommand) => void;
    api: EditorHandle;
    publishSelection: () => void;
    applyHistory: (action: HistoryAction) => void;
    surface: ReturnType<typeof SurfaceBindings.bind>;
    notice: (message: string) => void;
    lastWritingView: () => WritingView | null;
  };
}
