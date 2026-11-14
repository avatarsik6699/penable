import { BoardViewport } from "~/entities/board";
import type { SurfaceControls } from "../../../../model/workspace-model.types";
import type { EditorCommandTypes } from "./editor-commands.types";

function create(options: EditorCommandTypes.ControlsOptions): SurfaceControls {
  const {
    canvas,
    navigation,
    interactionsBlocked: externallyBlocked,
    selection,
    drawingPointerId,
    scene,
    state,
    selectionCommand,
    api,
    publishSelection,
    applyHistory,
  } = options;

  const interactionsBlocked = () =>
    externallyBlocked() || Boolean(options.touchBusy?.());

  const center = () => {
    const bounds = canvas.getBoundingClientRect();

    return {
      x: bounds.width / 2,
      y: bounds.height / 2,
    };
  };

  return {
    insertImage: () => {
      if (!interactionsBlocked()) options.insertImage();
    },

    insertTemplate: (config, explicitSize) => {
      if (!interactionsBlocked())
        options.insertTemplate?.(config, explicitSize);
    },

    dismissInsertion: options.dismissInsertion,

    transform: (width, height, angle) => {
      if (
        !interactionsBlocked() &&
        drawingPointerId() === null &&
        navigation.pointerId === null
      )
        selection.transform(width, height, angle);
    },

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
      if (
        interactionsBlocked() ||
        drawingPointerId() !== null ||
        navigation.pointerId !== null ||
        selection.busy
      )
        return;

      const view = BoardViewport.zoomAt(navigation.viewport, 1, center());

      if (!BoardViewport.isValid(view)) {
        options.notice(
          "Этот участок слишком далеко для масштаба 100%. Выберите более близкую область.",
        );

        return;
      }

      options.notice("");
      navigation.setViewport(view);
    },

    returnToWriting: () => {
      const view = options.lastWritingView();

      if (
        !view ||
        !scene.strokes.length ||
        interactionsBlocked() ||
        selection.busy ||
        drawingPointerId() !== null ||
        navigation.pointerId !== null
      )
        return;

      const bounds = canvas.getBoundingClientRect();

      const destination = BoardViewport.restoreWritingView(
        view,
        bounds.width,
        bounds.height,
      );

      if (!BoardViewport.isValid(destination)) {
        options.notice(
          "Место письма слишком далеко для перехода в этом окне. Выберите участок на миникарте.",
        );

        return;
      }

      options.notice("");
      navigation.setViewport(destination);
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
      selection.busy ||
      Boolean(options.pendingInput?.()) ||
      Boolean(options.touchBusy?.()),
    cancelInput: api.cancel,
  };
}

export const EditorControls = { create };
