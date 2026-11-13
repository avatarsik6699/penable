import type { SelectionCommand } from "../model/types";
import {
  BoardShortcuts,
  type BoardNavigation,
  type PenInput,
  type EraserInput,
  type BoardSelection,
  type DrawingTool,
  type Viewport,
  type HistoryAction,
} from "~/entities/board";
import { BoardCursor } from "./cursor";
import type { SurfaceElements } from "./surface-elements";
type BindingOptions = {
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
  drawingPointerId: () => number | null;
  activeInput: () => PenInput | EraserInput | BoardSelection;
  observeInput: (event?: PointerEvent) => void;
  publishHistoryState: () => void;
  selectionCommand: (command: SelectionCommand) => void;
  applyHistory: (action: HistoryAction) => void;
  paintSelection: () => void;
};
function bind(options: BindingOptions) {
  const {
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
    observeInput,
    publishHistoryState,
    selectionCommand,
    applyHistory,
    paintSelection,
  } = options;
  let disposed = false;
  let spaceDown = false;
  let focused = true;
  let keyboardEntry = false;
  let cursorFrame: number | null = null;
  let lastCursorEvent: PointerEvent | null = null;
  const cursor = new BoardCursor();
  const cursorLayer = elements.cursor;
  const paintCursor = () => {
    cursorFrame = null;
    if (disposed || !cursorLayer) return;
    const { visible, mode, position } = cursor.presentation;
    cursorLayer.hidden = !visible;
    cursorLayer.dataset.mode = mode;
    if (position)
      cursorLayer.style.transform = `translate(${position.x}px, ${position.y}px)`;
    canvas.dataset.appCursorReady = String(visible);
  };
  const updateCursor = () => {
    const mode =
      navigation.pointerId !== null
        ? "panning"
        : spaceDown && drawingPointerId() === null
          ? "pan-ready"
          : getTool() === "selection" &&
              (selection.moving ||
                (lastCursorEvent &&
                  selection.hit({
                    x:
                      (lastCursorEvent.clientX -
                        canvas.getBoundingClientRect().left -
                        state.viewport.x) /
                      state.viewport.zoom,
                    y:
                      (lastCursorEvent.clientY -
                        canvas.getBoundingClientRect().top -
                        state.viewport.y) /
                      state.viewport.zoom,
                  })))
            ? "move"
            : getTool();
    const event = lastCursorEvent;
    const overBoard =
      !event ||
      document.elementFromPoint(event.clientX, event.clientY) === canvas;
    cursor.configure(
      mode,
      focused &&
        document.visibilityState !== "hidden" &&
        !interactionsBlocked() &&
        overBoard,
    );
    if (cursorFrame === null) cursorFrame = requestAnimationFrame(paintCursor);
  };
  const cursorSample = (event: PointerEvent) => {
    const owner = drawingPointerId() ?? navigation.pointerId;
    if (
      (event.pointerType !== "mouse" && event.pointerType !== "pen") ||
      (owner !== null && owner !== event.pointerId)
    )
      return;
    lastCursorEvent = event;
    cursor.move(
      event,
      canvas.getBoundingClientRect(),
      document.elementFromPoint(event.clientX, event.clientY) === canvas,
    );
    updateCursor();
  };
  const refreshCursor = () => {
    paintSelection();
    if (lastCursorEvent) cursorSample(lastCursorEvent);
    else updateCursor();
  };

  const leave = (event: PointerEvent) => {
    cursor.leave(event, event.relatedTarget instanceof Element);
    updateCursor();
  };
  const over = (event: PointerEvent) => {
    if (event.target !== canvas) cursorSample(event);
  };
  const focusCanvas = () => {
    if (elements.focusBadge) elements.focusBadge.hidden = !keyboardEntry;
  };
  const blurCanvas = () => {
    selection.finishNudge();
    if (elements.focusBadge) elements.focusBadge.hidden = true;
  };
  const releaseCapture = (pointerId: number | null) => {
    if (pointerId === null) return;
    try {
      if (canvas.hasPointerCapture?.(pointerId))
        canvas.releasePointerCapture(pointerId);
    } catch {
      /* Synthetic events have no native pointer to capture or release. */
    }
  };
  const cancel = () => {
    const pointerId = drawingPointerId() ?? navigation.pointerId;
    input.cancel();
    eraser.cancel();
    selection.cancel();
    navigation.endPan();
    cursor.cancel();
    releaseCapture(pointerId);
    updateCursor();
    observeInput();
    publishHistoryState();
  };

  const down = (event: PointerEvent) => {
    if (interactionsBlocked()) return;
    keyboardEntry = false;
    blurCanvas();
    cursorSample(event);
    selection.finishNudge();
    if (
      navigation.startPan(event, spaceDown) ||
      (navigation.pointerId === null &&
        !spaceDown &&
        (getTool() === "selection"
          ? selection.down(event)
          : canWrite() &&
            (getTool() === "eraser" ? eraser : input).down(event)))
    ) {
      navigation.suspendWheel();
      cursor.begin(event.pointerId);
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* Window listeners are the fallback. */
      }
    }
    if (event.button === 1) event.preventDefault();
    startEdge();
    updateCursor();
    observeInput(event);
    publishHistoryState();
  };
  const move = (event: PointerEvent) => {
    cursorSample(event);
    if (
      (!canWrite() &&
        (input.pointerId !== null ||
          eraser.pointerId !== null ||
          selection.moving)) ||
      interactionsBlocked()
    ) {
      cancel();
      return;
    }
    const panPointer = navigation.pointerId;
    if (navigation.movePan(event)) {
      event.preventDefault();
      if (navigation.pointerId === null) {
        cursor.end(panPointer ?? undefined);
        releaseCapture(panPointer);
        publishHistoryState();
      }
      updateCursor();
      observeInput(event);
      return;
    }
    const pointerId = drawingPointerId();
    if (activeInput().move(event)) event.preventDefault();
    if (pointerId !== null && drawingPointerId() === null) {
      cursor.end(pointerId);
      releaseCapture(pointerId);
      publishHistoryState();
    }
    updateCursor();
    if (event.target === canvas || event.pointerId === pointerId)
      observeInput(event);
  };
  const up = (event: PointerEvent) => {
    cursorSample(event);
    cursor.end(event.pointerId);
    if (
      (!canWrite() &&
        (input.pointerId !== null ||
          eraser.pointerId !== null ||
          selection.moving)) ||
      interactionsBlocked()
    ) {
      cancel();
      return;
    }
    if (navigation.endPan(event.pointerId)) {
      event.preventDefault();
      releaseCapture(event.pointerId);
      updateCursor();
      observeInput(event);
      publishHistoryState();
      return;
    }
    const pointerId = drawingPointerId();
    if (activeInput().up(event)) {
      event.preventDefault();
      releaseCapture(event.pointerId);
      publishHistoryState();
    }
    updateCursor();
    if (event.target === canvas || event.pointerId === pointerId)
      observeInput(event);
  };
  const pointerCancel = (event: PointerEvent) => {
    if (
      event.pointerId !== drawingPointerId() &&
      event.pointerId !== navigation.pointerId
    )
      return;
    cancel();
    observeInput(event);
  };
  const lostCapture = (event: PointerEvent) => {
    const panEnded = navigation.endPan(event.pointerId);
    const inkEnded = input.cancel(event.pointerId);
    const eraseEnded = eraser.cancel(event.pointerId);
    const selectionEnded =
      selection.pointerId === event.pointerId && selection.cancel();
    if (panEnded || inkEnded || eraseEnded || selectionEnded) {
      cursor.end(event.pointerId);
      updateCursor();
      observeInput(event);
      publishHistoryState();
    }
  };
  const contextMenu = (event: MouseEvent) => event.preventDefault();
  const wheel = (event: WheelEvent) => {
    if (!event.cancelable) return;
    event.preventDefault();
    if (interactionsBlocked()) return;
    const bounds = canvas.getBoundingClientRect();
    navigation.wheel({
      deltaX: event.deltaX,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      anchor: { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      width: bounds.width,
      height: bounds.height,
    });
  };
  const keyDown = (event: KeyboardEvent) => {
    if (event.code === "Tab") keyboardEntry = true;
    if (interactionsBlocked()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const editable = Boolean(
      target?.closest("input,textarea,select,[contenteditable],dialog"),
    );
    const boardContext = Boolean(
      target === canvas || target?.closest("[data-board-selection-toolbar]"),
    );
    if (
      boardContext &&
      !editable &&
      !event.altKey &&
      !event.isComposing &&
      !event.defaultPrevented
    ) {
      const modifier = event.ctrlKey || event.metaKey;
      const commands: Record<string, SelectionCommand> = {
        KeyA: "all",
        KeyC: "copy",
        KeyX: "cut",
        KeyV: "paste",
        KeyD: "duplicate",
      };
      const command = modifier
        ? commands[event.code]
        : event.code === "Escape"
          ? "clear"
          : ["Delete", "Backspace"].includes(event.code)
            ? "delete"
            : undefined;
      if (command) {
        event.preventDefault();
        if (
          command === "clear" &&
          (drawingPointerId() !== null || navigation.pointerId !== null)
        )
          cancel();
        else selectionCommand(command);
        updateCursor();
        return;
      }
      const nudge = BoardShortcuts.selectionNudgeShortcut(event, {
        editable,
        inkPointerId: drawingPointerId(),
        panPointerId: navigation.pointerId,
      });
      if (nudge && getTool() === "selection" && selection.hasSelection) {
        event.preventDefault();
        if (!nudge.blocked) selection.nudge(nudge.x, nudge.y);
        return;
      }
    }
    const shortcut = BoardShortcuts.historyShortcut(event, {
      editable: Boolean(
        target?.closest('input:not([type="range"]),textarea,select') ||
        target?.isContentEditable,
      ),
      inkPointerId: drawingPointerId(),
      panPointerId: navigation.pointerId,
    });
    if (shortcut) {
      event.preventDefault();
      if (!shortcut.blocked) applyHistory(shortcut.action);
      return;
    }
    if (
      event.code !== "Space" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;
    if (
      target?.closest(
        'input:not([type="range"]),textarea,select,[contenteditable]',
      )
    )
      return;
    if (!target?.closest('button,summary,input[type="range"]'))
      event.preventDefault();
    spaceDown = true;
    updateCursor();
  };
  const keyUp = (event: KeyboardEvent) => {
    if (event.code.startsWith("Arrow")) selection.finishNudge();
    if (event.code !== "Space") return;
    spaceDown = false;
    updateCursor();
  };
  const blur = () => {
    focused = false;
    spaceDown = false;
    cancel();
  };
  const focus = () => {
    focused = true;
    refreshCursor();
  };
  const visibility = () => {
    if (document.visibilityState === "hidden") blur();
    else focus();
  };
  let edgeFrame: number | null = null;
  let edgeTime = performance.now();
  const edgeTick = (time: number) => {
    edgeFrame = null;
    if (disposed) return;
    if (selection.moving && lastCursorEvent) {
      const bounds = canvas.getBoundingClientRect();
      selection.edgePan(
        {
          x: lastCursorEvent.clientX - bounds.left,
          y: lastCursorEvent.clientY - bounds.top,
        },
        (time - edgeTime) / 1000,
      );
    }
    edgeTime = time;
    if (selection.moving) edgeFrame = requestAnimationFrame(edgeTick);
  };
  const startEdge = () => {
    if (selection.moving && edgeFrame === null) {
      edgeTime = performance.now();
      edgeFrame = requestAnimationFrame(edgeTick);
    }
  };
  canvas.addEventListener("pointerenter", cursorSample);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("focus", focusCanvas);
  canvas.addEventListener("blur", blurCanvas);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("lostpointercapture", lostCapture);
  canvas.addEventListener("contextmenu", contextMenu);
  canvas.addEventListener("wheel", wheel, { passive: false });
  // Window listeners also handle releases outside the sheet when capture is unavailable.
  window.addEventListener("pointerover", over);
  window.addEventListener("focus", focus);
  document.addEventListener("visibilitychange", visibility);
  document.addEventListener("toggle", refreshCursor, true);
  window.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", up, { passive: false });
  window.addEventListener("pointercancel", pointerCancel);
  window.addEventListener("blur", blur);
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);

  return {
    cancel,
    refresh: refreshCursor,
    dispose: () => {
      disposed = true;
      canvas.removeEventListener("pointerenter", cursorSample);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("focus", focusCanvas);
      canvas.removeEventListener("blur", blurCanvas);
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("lostpointercapture", lostCapture);
      canvas.removeEventListener("contextmenu", contextMenu);
      canvas.removeEventListener("wheel", wheel);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("toggle", refreshCursor, true);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", pointerCancel);
      window.removeEventListener("blur", blur);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);

      cancel();
      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);
      delete canvas.dataset.appCursorReady;
      if (cursorLayer) cursorLayer.hidden = true;
    },
  };
}
export const SurfaceBindings = { bind };
