import { NativeMinimap } from "./minimap";
import { SelectionCommands, HistoryCommands, EditorControls } from "./commands";
import type { SurfaceElements, EditorHandle } from "./editor-runtime.types";
import { SurfaceBindings } from "./bindings";
import { SurfaceResolution } from "./rendering";
import { SurfacePresenters } from "./rendering";
import { SurfaceDiagnostics } from "./rendering";
import { BoardSnapshots } from "~/entities/board";
import type { WritingSurfaceTypes } from "../writing-surface.types";
import { BoardCoordinates } from "~/entities/board";
import { EraserInput } from "~/entities/board";
import { PenInput } from "~/entities/board";
import { BoardSelection } from "~/entities/board";
import { CanvasRenderer } from "./rendering";
import type { Scene } from "~/entities/board";
import { BoardViewport } from "~/entities/board";
import { BoardNavigation } from "~/entities/board";
import { StrokeHistory } from "~/entities/board";
import { SelectionDocuments } from "~/features/board-document";
import { BoardIds } from "~/entities/board";

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
    onDocumentChange: notifyDocumentChange,
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
    };

    let minimap: NativeMinimap | null = null;
    let lastWritingView = initial.lastWritingView ?? null;

    const onDocumentChange = (urgent: boolean) => {
      if (urgent) {
        minimap?.invalidate();
        readSettings().onScenePresence(scene.strokes.length > 0);
      }

      notifyDocumentChange(urgent);
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
      SurfacePresenters.background(
        elements.background,
        state.viewport,
        readSettings().backgroundSettings,
      );

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

        const writingBounds = canvas.getBoundingClientRect();

        lastWritingView = BoardViewport.writingView(
          state.viewport,
          writingBounds.width,
          writingBounds.height,
        );

        readSettings().onWritingCommitted(lastWritingView);
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
        readSettings().onNavigationNotice("");
        renderer.setViewport(viewport);
        updateBackground();
        paintSelection();
        diagnostics.update({ zoom: viewport.zoom });
        minimap?.viewportChanged();

        if (canWrite() && !selection.busy) onDocumentChange(false);
      },
    });

    let disposed = false;
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
        busy: selection.busy || selectionCommands.busy,
        message: selection.message,
        png: selectionCommands.hasPNG,
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

    const selectionCommands = SelectionCommands.create({
      selection,
      input,
      eraser,
      navigation,
      interactionsBlocked,
      cancel: () => api.cancel(),
      onActivateSelection,
      publishSelection,
    });

    const selectionCommand = selectionCommands.command;

    const historyCommands = HistoryCommands.create({
      history,
      drawingPointerId,
      navigation,
      selection,
      canWrite,
      interactionsBlocked,
      renderer,
      onDocumentChange,
      onHistoryState,
      active: () => !disposed,
    });

    const publishHistoryState = () => {
      historyCommands.publish();
      readSettings().onScenePresence(scene.strokes.length > 0);
      minimap?.viewportChanged();
    };

    const applyHistory = historyCommands.apply;

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

    minimap = new NativeMinimap({
      elements,
      scene,
      viewport: () => state.viewport,
      bounds: () => canvas.getBoundingClientRect(),
      blocked: () =>
        interactionsBlocked() ||
        drawingPointerId() !== null ||
        navigation.pointerId !== null ||
        selection.busy,

      navigate: (viewport) => {
        if (!BoardViewport.isValid(viewport)) return false;

        navigation.setViewport(viewport);

        return true;
      },
    });

    api.refresh = () => {
      updateBackground();
      surface.refresh();
      minimap?.setOpen(readSettings().minimapOpen);
    };

    controlsRef.current = EditorControls.create({
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
      lastWritingView: () => lastWritingView,
      notice: (message) => readSettings().onNavigationNotice(message),
    });

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
      selectionCommands.dispose();
      api.cancel = () => {};
      api.refresh = () => {};
      surface.dispose();
      unbindResolution();
      selectionJobs.dispose();
      minimap?.dispose();
      renderer.dispose();
      controlsRef.current = null;
      diagnostics.dispose();
    };
  };

  api.dispose = cleanup() ?? (() => {});

  return api;
}

export const EditorRuntime = { create };

export type { EditorHandle } from "./editor-runtime.types";
