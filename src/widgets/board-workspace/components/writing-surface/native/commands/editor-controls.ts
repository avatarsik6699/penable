import { BoardViewport } from "~/entities/board";
import type { SurfaceControls } from "../../../../model/workspace-model.types";
import type { EditorCommandTypes } from "./editor-commands.types";

function create(options: EditorCommandTypes.ControlsOptions): SurfaceControls {
  const {
    canvas,
    navigation,
    interactionsBlocked,
    selection,
    drawingPointerId,
    scene,
    state,
    selectionCommand,
    api,
    publishSelection,
    applyHistory,
    surface,
  } = options;

  const center = () => {
    const bounds = canvas.getBoundingClientRect();

    return { x: bounds.width / 2, y: bounds.height / 2 };
  };

  return {
    zoomIn: () => {
      if (!interactionsBlocked())
        navigation.setZoom(navigation.viewport.zoom * 2, center());
    },

    zoomOut: () => {
      if (!interactionsBlocked())
        navigation.setZoom(navigation.viewport.zoom / 2, center());
    },

    fitAll: () => {
      if (
        !interactionsBlocked() &&
        !selection.busy &&
        drawingPointerId() === null &&
        navigation.pointerId === null
      ) {
        const bounds = canvas.getBoundingClientRect();

        navigation.setViewport(
          BoardViewport.fitAll(scene.strokes, bounds.width, bounds.height),
        );
      }
    },

    selection: (command) => {
      selectionCommand(command);
      api.refresh();
    },

    selectionShape: (shape) => {
      if (!selection.busy) {
        selection.shape = shape;
        publishSelection();
      }
    },

    reset: () => {
      if (!interactionsBlocked()) navigation.reset();
    },

    undo: () => {
      applyHistory("undo");
    },

    redo: () => {
      applyHistory("redo");
    },

    snapshot: () => ({ strokes: scene.strokes, viewport: state.viewport }),
    isBusy: () =>
      drawingPointerId() !== null ||
      navigation.pointerId !== null ||
      selection.busy,
    cancelInput: surface.cancel,
  };
}

export const EditorControls = { create };
