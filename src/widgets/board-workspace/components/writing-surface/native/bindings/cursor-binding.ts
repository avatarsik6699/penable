import { BoardCursor } from "../rendering";
import type {
  BindingOptions,
  InteractionState,
} from "./surface-bindings.types";

function create(
  options: Pick<
    BindingOptions,
    | "elements"
    | "canvas"
    | "state"
    | "navigation"
    | "selection"
    | "getTool"
    | "interactionsBlocked"
    | "drawingPointerId"
    | "paintSelection"
  >,
  interaction: InteractionState,
) {
  const {
    elements,
    canvas,
    state,
    navigation,
    selection,
    getTool,
    interactionsBlocked,
    drawingPointerId,
    paintSelection,
  } = options;

  let disposed = false;
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
        : interaction.spaceDown && drawingPointerId() === null
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
      interaction.focused &&
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
    if (elements.focusBadge)
      elements.focusBadge.hidden = !interaction.keyboardEntry;
  };

  const blurCanvas = () => {
    selection.finishNudge();

    if (elements.focusBadge) elements.focusBadge.hidden = true;
  };

  return {
    model: cursor,
    sample: cursorSample,
    update: updateCursor,
    refresh: refreshCursor,
    leave,
    over,
    focusCanvas,
    blurCanvas,
    get lastEvent() {
      return lastCursorEvent;
    },

    dispose() {
      disposed = true;

      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame);

      delete canvas.dataset.appCursorReady;

      if (cursorLayer) cursorLayer.hidden = true;
    },
  };
}

export const CursorBinding = { create };
