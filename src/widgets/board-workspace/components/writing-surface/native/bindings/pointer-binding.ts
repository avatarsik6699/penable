import type {
  BindingOptions,
  InteractionState,
} from "./surface-bindings.types";
import type { CursorBinding } from "./cursor-binding";
import type { EdgePan } from "./edge-pan";
import type { TouchBinding } from "./touch-binding";

function create(
  options: Pick<
    BindingOptions,
    | "templatePlacement"
    | "canvas"
    | "navigation"
    | "input"
    | "eraser"
    | "selection"
    | "getTool"
    | "canWrite"
    | "interactionsBlocked"
    | "drawingPointerId"
    | "activeInput"
    | "observeInput"
    | "publishHistoryState"
  >,
  interaction: InteractionState,
  cursor: ReturnType<typeof CursorBinding.create>,
  edge: ReturnType<typeof EdgePan.create>,
  touch: ReturnType<typeof TouchBinding.create>,
) {
  const {
    canvas,
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
  } = options;

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
    touch.cancel();
    options.templatePlacement?.cancel();

    const pointerId = drawingPointerId() ?? navigation.pointerId;

    input.cancel();
    eraser.cancel();
    selection.cancel();
    navigation.endPan();
    cursor.model.cancel();
    releaseCapture(pointerId);
    cursor.update();
    observeInput();
    publishHistoryState();
  };

  const down = (event: PointerEvent) => {
    if (interactionsBlocked()) return;

    if (event.pointerType === "touch") {
      touch.down(event);
      cursor.model.cancel();
      cursor.update();

      return;
    }

    if (
      event.pointerType === "pen" &&
      event.isPrimary &&
      event.button === 0 &&
      event.buttons === 1
    )
      touch.preempt();
    else if (touch.busy) return;

    interaction.keyboardEntry = false;
    cursor.blurCanvas();
    cursor.sample(event);
    selection.finishNudge();

    if (
      options.templatePlacement?.active &&
      !interaction.spaceDown &&
      event.button === 0 &&
      event.buttons === 1 &&
      event.isPrimary &&
      (event.pointerType === "pen" || event.pointerType === "mouse")
    ) {
      if (canWrite() && navigation.pointerId === null)
        options.templatePlacement.place(event.clientX, event.clientY);

      event.preventDefault();

      return;
    }

    if (
      navigation.startPan(event, interaction.spaceDown) ||
      (navigation.pointerId === null &&
        !interaction.spaceDown &&
        (getTool() === "selection"
          ? selection.down(event)
          : canWrite() &&
            (getTool() === "eraser" ? eraser : input).down(event)))
    ) {
      navigation.suspendWheel();
      cursor.model.begin(event.pointerId);
      event.preventDefault();
      canvas.focus({ preventScroll: true });

      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* Window listeners are the fallback. */
      }
    }

    if (event.button === 1) event.preventDefault();

    edge.start();
    cursor.update();
    observeInput(event);
    publishHistoryState();
  };

  const move = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      touch.move(event);

      return;
    }

    // A pen-tip transition can arrive as pointermove (e.g. chorded buttons).
    // button=-1 means held motion, and must never resurrect cancelled input.
    if (
      event.target === canvas &&
      interaction.focused &&
      !interaction.spaceDown &&
      !options.templatePlacement?.active &&
      event.pointerType === "pen" &&
      event.isPrimary &&
      event.button === 0 &&
      event.buttons === 1 &&
      drawingPointerId() === null &&
      navigation.pointerId === null
    ) {
      down(event);

      return;
    }

    if (
      event.pointerType !== "pen" ||
      (event.buttons & 1) !== 0 ||
      drawingPointerId() !== event.pointerId
    )
      cursor.sample(event);

    if (event.target === canvas && options.templatePlacement?.active)
      options.templatePlacement.move(event.clientX, event.clientY);

    if (
      (!canWrite() &&
        (input.pointerId !== null ||
          eraser.pointerId !== null ||
          selection.pointerId !== null)) ||
      interactionsBlocked()
    ) {
      cancel();

      return;
    }

    const panPointer = navigation.pointerId;

    if (navigation.movePan(event)) {
      event.preventDefault();

      if (navigation.pointerId === null) {
        cursor.model.end(panPointer ?? undefined);
        releaseCapture(panPointer);
        publishHistoryState();
      }

      cursor.update();
      observeInput(event);

      return;
    }

    const pointerId = drawingPointerId();

    if (activeInput().move(event)) event.preventDefault();

    if (pointerId !== null && drawingPointerId() === null) {
      cursor.model.end(pointerId);
      releaseCapture(pointerId);
      publishHistoryState();
    }

    cursor.update();

    if (event.target === canvas || event.pointerId === pointerId)
      observeInput(event);
  };

  const up = (event: PointerEvent) => {
    if (event.pointerType === "touch") {
      touch.up(event);

      return;
    }

    if (event.pointerType !== "pen") cursor.sample(event);

    cursor.model.end(event.pointerId);

    if (
      (!canWrite() &&
        (input.pointerId !== null ||
          eraser.pointerId !== null ||
          selection.pointerId !== null)) ||
      interactionsBlocked()
    ) {
      cancel();

      return;
    }

    if (navigation.endPan(event.pointerId)) {
      event.preventDefault();
      releaseCapture(event.pointerId);
      cursor.update();
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

    cursor.update();

    if (event.target === canvas || event.pointerId === pointerId)
      observeInput(event);
  };

  const pointerCancel = (event: PointerEvent) => {
    if (touch.has(event.pointerId)) {
      touch.cancel(event.pointerId);

      return;
    }

    if (
      event.pointerId !== drawingPointerId() &&
      event.pointerId !== navigation.pointerId
    )
      return;

    cancel();
    observeInput(event);
  };

  const lostCapture = (event: PointerEvent) => {
    if (touch.has(event.pointerId)) {
      touch.cancel(event.pointerId);

      return;
    }

    const panEnded = navigation.endPan(event.pointerId);
    const inkEnded = input.cancel(event.pointerId);
    const eraseEnded = eraser.cancel(event.pointerId);

    const selectionEnded =
      selection.pointerId === event.pointerId && selection.cancel();

    if (panEnded || inkEnded || eraseEnded || selectionEnded) {
      cursor.model.end(event.pointerId);
      cursor.update();
      observeInput(event);
      publishHistoryState();
    }
  };

  const contextMenu = (event: MouseEvent) => event.preventDefault();

  const wheel = (event: WheelEvent) => {
    if (!event.cancelable) return;

    event.preventDefault();

    if (interactionsBlocked() || touch.busy) return;

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

  return {
    cancel,
    touchActive: () => touch.busy,
    down,
    move,
    up,
    pointerCancel,
    lostCapture,
    contextMenu,
    wheel,
  };
}

export const PointerBinding = { create };
