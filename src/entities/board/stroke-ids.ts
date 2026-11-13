import type { Stroke } from "./types";
import { BoardLimits } from "./scene-limits";

// A batch reserves IDs incrementally; source fragments must never rescan the scene
// for every inserted item. The single-stroke capture path uses the same allocator.
function createStrokeIdAllocator(strokes: readonly Stroke[]): () => number {
  let maximum = 0;
  const used = new Set<number>();

  for (const stroke of strokes) {
    used.add(stroke.id);
    maximum = Math.max(maximum, stroke.id);
  }

  let next = maximum < BoardLimits.MAX_STROKE_ID ? maximum + 1 : 1;

  return () => {
    const start = next;

    while (used.has(next)) {
      next = next < BoardLimits.MAX_STROKE_ID ? next + 1 : 1;

      if (next === start)
        throw new Error("Нет свободного допустимого ID штриха.");
    }

    const id = next;

    used.add(id);
    next = next < BoardLimits.MAX_STROKE_ID ? next + 1 : 1;

    return id;
  };
}

function allocateStrokeId(strokes: readonly Stroke[]): number {
  return createStrokeIdAllocator(strokes)();
}

export const BoardIds = { createStrokeIdAllocator, allocateStrokeId };
