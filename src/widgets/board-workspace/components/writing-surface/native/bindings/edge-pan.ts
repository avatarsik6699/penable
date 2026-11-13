import type { BindingOptions } from "./surface-bindings.types";
import type { CursorBinding } from "./cursor-binding";

function create(
  options: Pick<BindingOptions, "canvas" | "selection">,
  cursor: ReturnType<typeof CursorBinding.create>,
) {
  const { canvas, selection } = options;
  let disposed = false;
  let edgeFrame: number | null = null;
  let edgeTime = performance.now();

  const edgeTick = (time: number) => {
    edgeFrame = null;

    if (disposed) return;

    if (selection.moving && cursor.lastEvent) {
      const bounds = canvas.getBoundingClientRect();

      selection.edgePan(
        {
          x: cursor.lastEvent.clientX - bounds.left,
          y: cursor.lastEvent.clientY - bounds.top,
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

  return {
    start: startEdge,

    dispose() {
      disposed = true;

      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame);
    },
  };
}

export const EdgePan = { create };
