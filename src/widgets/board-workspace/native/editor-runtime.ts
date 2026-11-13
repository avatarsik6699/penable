import type { SurfaceElements } from "./surface-elements";
import type { SelectionCommand } from "../model/types";
import { SurfaceBindings } from "./surface-bindings";
import { SurfaceResolution } from "./surface-resolution";
import { SurfacePresenters } from "./surface-presenters";
import { SurfaceDiagnostics } from "./surface-diagnostics";
import { BoardSnapshots } from "~/entities/board";
import type { WritingSurfaceTypes } from "../ui/writing-surface.types";
import { BoardCoordinates } from "~/entities/board";
import { EraserInput } from "~/entities/board";
import { PenInput } from "~/entities/board";
import { BoardSelection } from "~/entities/board";
import { BoardPNG } from "../native/png";
import { CanvasRenderer } from "../native/renderer";
import type { HistoryState, Scene } from "~/entities/board";
import { BoardNavigation, BoardViewport } from "~/entities/board";
import { StrokeHistory } from "~/entities/board";
import { type HistoryAction } from "~/entities/board";
import { SelectionDocuments } from "~/features/board-document";
import { BoardIds } from "~/entities/board";

export type EditorHandle = {
  refresh: () => void;
  cancel: () => void;
  dispose: () => void;
};

function create(
  elements: SurfaceElements,
  readSettings: () => WritingSurfaceTypes.Props,
): EditorHandle {
  const {
    initialDocument,
    clipboard,
    canWrite,
    interactionsBlocked,
    onActivateSelection,
    onSelectionState,
    getTool,
    onDocumentChange,
    onHistoryState,
    controlsRef,
    onDiagnostics,
    onUnavailable,
  } = readSettings();

  const api: EditorHandle = {
    refresh: () => {},

    cancel: () => {},

    dispose: () => {},
  };

  const cleanup = () => {
    const canvas = elements.canvas;
    const completedCanvas = elements.completed;

    if (!canvas || !completedCanvas) return;

    let context: CanvasRenderingContext2D | null = null;
    let completedContext: CanvasRenderingContext2D | null = null;

    try {
      context = canvas.getContext("2d");
      completedContext = completedCanvas.getContext("2d");
    } catch {
      /* Report the same capability fallback below. */
    }

    if (!context || !completedContext || typeof PointerEvent === "undefined") {
      onUnavailable(
        !context || !completedContext
          ? "В этом браузере недоступен Canvas 2D."
          : "В этом браузере недоступны Pointer Events.",
      );

      return;
    }

    const initial = BoardSnapshots.clone(initialDocument);
    const scene: Scene = { strokes: initial.strokes, active: null };

    const state = {
      viewport: initial.viewport,
      history: null as HistoryState | null,
    };

    const history = new StrokeHistory(scene.strokes, scene.strokes.length);
    const visualViewport = window.visualViewport;

    const renderer = new CanvasRenderer(
      { canvas: completedCanvas, context: completedContext },
      { canvas, context },
      scene,
      state.viewport,
    );

    const updateBackground = () =>
      SurfacePresenters.background(elements.background, state.viewport);

    const input = new PenInput({
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      viewport: () => state.viewport,
      width: () => readSettings().width,
      stabilization: () => readSettings().stabilization,
      allocateId: () => BoardIds.allocateStrokeId(scene.strokes),
      onActiveChange: () => renderer.activeChanged(),

      onCommit: (stroke) => {
        if (!canWrite()) {
          renderer.activeChanged();

          return;
        }

        selection.clear();
        history.commit(stroke);
        renderer.commit(stroke);
        publishHistoryState();
        onDocumentChange(true);
      },
    });

    const eraser = new EraserInput({
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      viewport: () => state.viewport,
      onPreviewChange: () => renderer.setEraserPreview(eraser.preview),

      onCommit: (strokes) => {
        if (!canWrite() || interactionsBlocked()) return;

        selection.clear();

        if (history.erase(strokes)) onDocumentChange(true);
      },
    });

    const drawingPointerId = (): number | null =>
      input.pointerId ?? eraser.pointerId ?? selection.pointerId;

    const activeInput = () =>
      selection.pointerId !== null
        ? selection
        : eraser.pointerId !== null
          ? eraser
          : input;

    const diagnostics = new SurfaceDiagnostics(
      {
        pointerType: null,
        pressure: null,
        active: false,
        dpr: BoardCoordinates.validDpr(window.devicePixelRatio),
        coalesced:
          typeof PointerEvent.prototype.getCoalescedEvents === "function",
        zoom: state.viewport.zoom,
        nativeScale: BoardCoordinates.validDpr(visualViewport?.scale ?? 1),
        requestedRatio: 1,
        effectiveRatio: 1,
        bitmapWidth: 0,
        bitmapHeight: 0,
        resolutionCapped: false,
      },
      onDiagnostics,
      drawingPointerId,
    );

    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: state.viewport,
      isDrawing: () => drawingPointerId() !== null || selection.busy,

      onChange: (viewport) => {
        state.viewport = viewport;
        renderer.setViewport(viewport);
        updateBackground();
        paintSelection();
        diagnostics.update({ zoom: viewport.zoom });

        if (canWrite() && !selection.busy) onDocumentChange(false);
      },
    });

    let disposed = false;
    let pngBusy = false;
    let pngBlob: Blob | null = null;
    let pngGeneration = 0;
    let previousSelectionState = "";

    const paintSelection = () =>
      SurfacePresenters.selection(
        elements.selectionPath,
        state.viewport,
        selection,
        getTool(),
      );

    const publishSelection = () => {
      if (disposed) return;

      paintSelection();

      const state = {
        selected: selection.hasSelection,
        clipboard: selection.hasClipboard,
        busy: selection.busy || pngBusy,
        message: selection.message,
        png: pngBlob !== null,
      };

      const encoded = JSON.stringify(state);

      if (encoded !== previousSelectionState) {
        previousSelectionState = encoded;
        onSelectionState(state);
      }

      publishHistoryState();
    };

    const selectionJobs = new SelectionDocuments();

    const selection = new BoardSelection({
      scene,
      clipboard,
      viewport: () => state.viewport,
      bounds: () => canvas.getBoundingClientRect(),
      writable: canWrite,
      select: (region, signal) =>
        selectionJobs.select(scene.strokes, region, signal),
      validate: (strokes, signal) =>
        selectionJobs.validate(
          { ...initialDocument, strokes, viewport: { ...state.viewport } },
          signal,
        ),

      commit: (strokes) => {
        if (history.replace(strokes)) {
          renderer.sceneChanged();
          onDocumentChange(true);
        }
      },

      preview: (strokes) => renderer.setSelectionPreview(strokes),
      changed: publishSelection,

      setViewport: (viewport) => {
        navigation.setViewport(viewport);
      },
    });

    const selectionCommand = (command: SelectionCommand) => {
      if (
        interactionsBlocked() ||
        input.pointerId !== null ||
        eraser.pointerId !== null ||
        navigation.pointerId !== null
      )
        return;

      if (command === "clear") {
        if (selection.busy) api.cancel();
        else selection.clear();

        return;
      }

      if (selection.busy) return;

      if (["all", "paste", "duplicate"].includes(command))
        onActivateSelection();

      if (command === "all") selection.all();

      if (command === "copy") selection.copy();

      if (command === "cut") selection.remove(true);

      if (command === "delete") selection.remove();

      if (command === "paste") selection.insert();

      if (command === "duplicate") selection.insert(true);

      if (command === "download" && pngBlob) BoardPNG.downloadPNG(pngBlob);

      if (command === "image" && selection.hasSelection && !pngBusy) {
        pngBusy = true;
        publishSelection();

        const generation = ++pngGeneration;

        const promise = BoardPNG.selectionPNG(
          selection.selected,
          selection.outline,
        );

        // Invoke the clipboard API in the user gesture, passing a deferred PNG Blob.
        const clipboard = BoardPNG.writePNG(promise);

        void Promise.allSettled([promise, clipboard]).then(
          ([result, written]) => {
            if (disposed || generation !== pngGeneration) return;

            pngBusy = false;

            if (result.status === "fulfilled") pngBlob = result.value;

            selection.message =
              result.status === "rejected"
                ? String(
                    result.reason instanceof Error
                      ? result.reason.message
                      : result.reason,
                  )
                : written.status === "fulfilled"
                  ? "PNG передан в системный буфер."
                  : "Не удалось записать PNG в системный буфер. Откройте «Действия» → «Скачать PNG».";

            publishSelection();
          },
        );
      }
    };

    const publishHistoryState = () => {
      if (disposed) return;

      const next = {
        canUndo: history.canUndo,
        canRedo: history.canRedo,
        busy:
          drawingPointerId() !== null ||
          navigation.pointerId !== null ||
          selection.busy,
      };

      const previous = state.history;

      if (
        previous &&
        previous.canUndo === next.canUndo &&
        previous.canRedo === next.canRedo &&
        previous.busy === next.busy
      )
        return;

      state.history = next;
      onHistoryState(next);
    };

    const applyHistory = (action: HistoryAction) => {
      if (
        !canWrite() ||
        interactionsBlocked() ||
        drawingPointerId() !== null ||
        navigation.pointerId !== null ||
        selection.busy
      )
        return;

      if (action === "undo" ? history.undo() : history.redo()) {
        selection.clear();
        renderer.sceneChanged();
        publishHistoryState();
        onDocumentChange(true);
      }
    };

    const surface = SurfaceBindings.bind({
      elements,
      canvas,
      state,
      navigation,
      input,
      eraser,
      selection,
      getTool,
      canWrite,
      interactionsBlocked,
      drawingPointerId,
      activeInput,
      observeInput: diagnostics.observe,
      publishHistoryState,
      selectionCommand,
      applyHistory,
      paintSelection,
    });

    api.cancel = surface.cancel;
    api.refresh = surface.refresh;

    const center = () => {
      const bounds = canvas.getBoundingClientRect();

      return { x: bounds.width / 2, y: bounds.height / 2 };
    };

    controlsRef.current = {
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

    const unbindResolution = SurfaceResolution.bind(
      canvas,
      renderer,
      surface.cancel,
      (value) => diagnostics.update(value),
    );

    updateBackground();
    publishSelection();
    publishHistoryState();

    return () => {
      disposed = true;
      pngGeneration++;
      api.cancel = () => {};
      api.refresh = () => {};
      surface.dispose();
      unbindResolution();
      selectionJobs.dispose();
      renderer.dispose();
      controlsRef.current = null;
      diagnostics.dispose();
    };
  };

  api.dispose = cleanup() ?? (() => {});

  return api;
}

export const EditorRuntime = { create };
