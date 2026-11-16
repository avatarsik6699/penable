import { Messages } from "~/shared/lib/messages";
import { TemplatePlacement } from "./templates";
import { BoardClipboard } from "./clipboard";
import { BitmapCache, ImageInput } from "./images";
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
          ? Messages.create("canvas2dIsUnavailableInThisBrowser")
          : Messages.create("pointerEventsAreUnavailableInThisBrowser"),
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
    let usesImages = scene.strokes.some((item) => item.kind === "image");

    const onDocumentChange = (urgent: boolean) => {
      if (urgent) {
        if (usesImages) {
          images.retain(scene.strokes);

          void images.ready(scene.strokes).catch((error) => {
            if (!disposed)
              readSettings().onNavigationNotice(
                error instanceof Error
                  ? Messages.from(error)
                  : Messages.create("couldNotLoadTheImage"),
              );
          });
        }

        minimap?.invalidate();
        readSettings().onScenePresence(scene.strokes.length > 0);
      }

      notifyDocumentChange(urgent);
    };

    const history = new StrokeHistory(scene.strokes, scene.strokes.length);
    const visualViewport = window.visualViewport;
    const images = new BitmapCache(() => renderer.sceneChanged());

    const renderer = new CanvasRenderer(
      { canvas: completedCanvas, context: completedContext },
      { canvas, context },
      scene,
      state.viewport,
      undefined,
      images.get,
    );

    void images.ready(scene.strokes).catch((error) => {
      if (!disposed) readSettings().onNavigationNotice(Messages.from(error));
    });

    const updateBackground = () =>
      SurfacePresenters.background(
        elements.background,
        state.viewport,
        readSettings().backgroundSettings,
      );

    let touchActive = () => false;

    const allowTouch = () => readSettings().getFingerInput?.() ?? false;

    const input = new PenInput({
      allowTouch,
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      viewport: () => state.viewport,
      width: () => readSettings().width,
      writing: () => readSettings().writing!,
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
      allowTouch,
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
        inputEvent: null,
        lastPenContact: null,
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
      isDrawing: () =>
        drawingPointerId() !== null || selection.busy || touchActive(),

      onChange: (viewport) => {
        state.viewport = viewport;
        readSettings().onNavigationNotice("");
        renderer.setViewport(viewport);
        updateBackground();
        paintSelection();
        diagnostics.update({ zoom: viewport.zoom });
        minimap?.viewportChanged();
        templatePlacement.refresh();

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
        elements.selectionHandles,
      );

    const publishSelection = () => {
      if (disposed) return;

      paintSelection();

      const state = {
        insertion: templatePlacement.active
          ? {
              phase: "placing" as const,
              message: Messages.create("clickTheBoardToPlaceEscTo"),
            }
          : imageInput.status,
        selected: selection.hasSelection,
        images: selection.hasImages,
        clipboard: true,
        busy: selection.busy || selectionCommands.busy || imageInput.busy,
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
      allowTouch,
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
          usesImages ||= strokes.some((item) => item.kind === "image");
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

    const imageInput = new ImageInput({
      canvas,
      scene,
      images,
      viewport: () => state.viewport,
      allowed: () =>
        !disposed &&
        canWrite() &&
        !interactionsBlocked() &&
        drawingPointerId() === null &&
        navigation.pointerId === null &&
        !touchActive() &&
        !selection.busy,

      insert: (items, signal) => {
        onActivateSelection();

        return selection.insertItemsDetailed(items, signal);
      },

      notice: (message) => {
        selection.message = message;
        publishSelection();
      },

      changed: () => publishSelection(),
    });

    const templatePlacement = new TemplatePlacement({
      allowed: () =>
        !disposed &&
        canWrite() &&
        !interactionsBlocked() &&
        drawingPointerId() === null &&
        !selection.busy &&
        !imageInput.busy,
      viewport: () => state.viewport,
      bounds: () => canvas.getBoundingClientRect(),
      allocate: () => BoardIds.allocateStrokeId(scene.strokes),
      draw: (item) => renderer.setTemplatePreview(item),

      notice: (message) => {
        if (!(
          Messages.is(message) && message.code === "clickTheBoardToPlaceEscTo"
        ))
          readSettings().onNavigationNotice(message);

        publishSelection();
      },

      insert: (item) => {
        onActivateSelection();

        return selection.insertItems([item]);
      },
    });

    const nativeClipboard = new BoardClipboard({
      canvas,
      selection,
      images,
      allowed: () =>
        !disposed &&
        !imageInput.busy &&
        !interactionsBlocked() &&
        drawingPointerId() === null &&
        navigation.pointerId === null &&
        !touchActive() &&
        !selection.busy,
      writable: canWrite,
      insertImage: (blob) => imageInput.insertFile(blob),
      activate: onActivateSelection,
      changed: publishSelection,
    });

    const selectionCommands = SelectionCommands.create({
      clipboard: nativeClipboard,
      pendingInput: () => imageInput.busy || nativeClipboard.busy,
      touchBusy: () => touchActive(),
      images,
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
      additionalBusy: () =>
        imageInput.busy || nativeClipboard.busy || touchActive(),
      touchBusy: () => touchActive(),
      history,
      drawingPointerId,
      navigation,
      selection,
      canWrite,
      interactionsBlocked: () =>
        interactionsBlocked() || imageInput.busy || nativeClipboard.busy,
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
      templatePlacement,

      cancelPendingInput: () => {
        if (templatePlacement.cancel()) return true;

        if (
          interactionsBlocked() ||
          (!imageInput.busy && !nativeClipboard.busy)
        )
          return false;

        imageInput.cancel();
        nativeClipboard.cancel();

        return true;
      },

      elements,
      canvas,
      state,
      navigation,
      input,
      eraser,
      selection,
      getTool,
      getFingerInput: allowTouch,
      canWrite,
      interactionsBlocked,
      inputBusy: () => imageInput.busy || nativeClipboard.busy,
      preservePendingInsertion: () => imageInput.busy,
      drawingPointerId,
      activeInput,
      observeInput: diagnostics.observe,
      publishHistoryState,
      selectionCommand,
      applyHistory,
      paintSelection,
    });

    touchActive = surface.isTouchActive;

    api.cancel = () => {
      templatePlacement.cancel();
      imageInput.cancel();
      nativeClipboard.cancel();
      surface.cancel();
    };

    minimap = new NativeMinimap({
      elements,
      scene,
      viewport: () => state.viewport,
      bounds: () => canvas.getBoundingClientRect(),
      blocked: () =>
        interactionsBlocked() ||
        drawingPointerId() !== null ||
        navigation.pointerId !== null ||
        touchActive() ||
        selection.busy,

      navigate: (viewport) => {
        if (!BoardViewport.isValid(viewport)) return false;

        navigation.setViewport(viewport);

        return true;
      },
    });

    api.refresh = () => {
      updateBackground();

      if (!canWrite() || interactionsBlocked()) imageInput.cancel();

      if (interactionsBlocked()) nativeClipboard.cancel();
      else nativeClipboard.permissionChanged();

      if (!canWrite() || interactionsBlocked()) templatePlacement.cancel();

      surface.refresh();
      minimap?.setOpen(readSettings().minimapOpen);
    };

    controlsRef.current = EditorControls.create({
      pendingInput: () => imageInput.busy || nativeClipboard.busy,
      canvas,
      navigation,
      interactionsBlocked: () =>
        interactionsBlocked() || imageInput.busy || nativeClipboard.busy,
      selection,
      drawingPointerId,
      scene,
      state,
      selectionCommand,
      api,
      publishSelection,
      applyHistory,
      surface,
      touchBusy: () => touchActive(),

      insertImage: () => {
        templatePlacement.cancel();
        imageInput.open();
      },

      insertTemplate: (config, explicitSize) => {
        selection.clear();
        templatePlacement.arm(config, explicitSize);
      },

      dismissInsertion: () => {
        templatePlacement.cancel();
        imageInput.dismiss();
      },

      lastWritingView: () => lastWritingView,
      notice: (message) => readSettings().onNavigationNotice(message),
    });

    const unbindResolution = SurfaceResolution.bind(
      canvas,
      renderer,
      api.cancel,
      (value) => diagnostics.update(value),
    );

    updateBackground();
    publishSelection();
    publishHistoryState();

    return () => {
      disposed = true;
      templatePlacement.cancel();
      selectionCommands.dispose();
      api.cancel = () => {};
      api.refresh = () => {};
      surface.dispose();
      unbindResolution();
      selectionJobs.dispose();
      minimap?.dispose();
      renderer.dispose();
      imageInput.dispose();
      images.dispose();
      controlsRef.current = null;
      diagnostics.dispose();
    };
  };

  api.dispose = cleanup() ?? (() => {});

  return api;
}

export const EditorRuntime = { create };

export type { EditorHandle } from "./editor-runtime.types";
