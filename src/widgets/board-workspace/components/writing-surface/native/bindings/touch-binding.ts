import { BoardTouchGestures, type PointerInput } from "~/entities/board";
import type { BindingOptions } from "./surface-bindings.types";

function create(options: BindingOptions) {
  const cancelEdit = () => {
    options.input.cancel();
    options.eraser.cancel();
    options.selection.cancel();
  };

  const touch = new BoardTouchGestures({
    viewport: () => options.navigation.viewport,
    navigate: (viewport) => options.navigation.setViewport(viewport),

    origin: () => {
      const bounds = options.canvas.getBoundingClientRect();

      return { x: bounds.left, y: bounds.top };
    },

    editing: () => options.getFingerInput?.() ?? false,
    blocked: () =>
      options.interactionsBlocked() || Boolean(options.inputBusy?.()),

    occupied: (editingPointerId) => {
      const owner = options.drawingPointerId();

      return (
        options.navigation.pointerId !== null ||
        (owner !== null && owner !== editingPointerId) ||
        (options.selection.busy && options.selection.pointerId === null)
      );
    },

    beginEdit: (event) => {
      if (!options.canWrite()) return false;

      return options.getTool() === "selection"
        ? options.selection.down(event)
        : (options.getTool() === "eraser"
            ? options.eraser
            : options.input
          ).down(event);
    },

    moveEdit: (event) => {
      if (!options.canWrite()) {
        touch.preempt();

        return;
      }

      options.activeInput().move(event);
    },

    endEdit: (event) => {
      if (!options.canWrite()) cancelEdit();
      else options.activeInput().up(event);
    },

    cancelEdit,
    placement: () =>
      Boolean(options.templatePlacement?.active && options.canWrite()),

    prepareTap: (event) =>
      options.getTool() === "selection"
        ? options.selection.prepareTextTap(event)
        : null,

    place: (event) => {
      if (options.canWrite())
        options.templatePlacement?.place(event.clientX, event.clientY);
    },
  });

  const release = (pointerId: number) => {
    try {
      if (options.canvas.hasPointerCapture?.(pointerId))
        options.canvas.releasePointerCapture(pointerId);
    } catch {
      /* Synthetic pointers have no native capture. */
    }
  };

  let previousBusy = false;

  const changed = (event?: PointerInput) => {
    if (previousBusy !== touch.busy) {
      previousBusy = touch.busy;
      options.publishHistoryState();
    }

    if (event) options.observeInput(event as PointerEvent);
  };

  return {
    get busy() {
      return touch.busy;
    },
    has: (pointerId: number) => touch.has(pointerId),

    preempt: () => {
      touch.preempt();
      changed();
    },

    down: (event: PointerEvent) => {
      if (!touch.down(event)) return false;

      options.navigation.suspendWheel();
      options.canvas.focus({ preventScroll: true });
      event.preventDefault();

      try {
        options.canvas.setPointerCapture?.(event.pointerId);
      } catch {
        /* Window listeners remain the fallback. */
      }

      changed(event);

      return true;
    },

    move: (event: PointerEvent) => {
      if (!touch.move(event)) return false;

      event.preventDefault();
      changed(event);

      return true;
    },

    up: (event: PointerEvent) => {
      if (!touch.up(event)) return false;

      event.preventDefault();
      release(event.pointerId);
      changed(event);

      return true;
    },

    cancel: (pointerId?: number) => {
      const ids = pointerId === undefined ? touch.pointerIds : [pointerId];
      const cancelled = touch.cancel(pointerId);

      for (const id of ids) release(id);

      if (cancelled) changed();

      return cancelled;
    },
  };
}

export const TouchBinding = { create };
