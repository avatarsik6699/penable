import { type ClipMask, type Stroke } from "../../../board.types";
import { union } from "polygon-clipping";

const unionCache = new WeakMap<ClipMask, WeakMap<ClipMask, ClipMask>>();

function combinedMask(a: ClipMask, b: ClipMask): ClipMask {
  let cache = unionCache.get(a);

  if (!cache) {
    cache = new WeakMap();
    unionCache.set(a, cache);
  }

  let result = cache.get(b);

  if (!result) {
    result = union(a, b);
    cache.set(b, result);
  }

  return result;
}

function groupedStrokes(strokes: readonly Stroke[]): Stroke[] {
  const result: Stroke[] = [],
    groups = new Map<string, number>();

  for (const stroke of strokes) {
    if (!stroke.source) {
      result.push(stroke);
      continue;
    }

    const offset = stroke.translation ?? { x: 0, y: 0 };
    const key = `${stroke.source}:${offset.x}:${offset.y}`;
    const index = groups.get(key);

    if (index === undefined) {
      groups.set(key, result.length);
      result.push(stroke);
      continue;
    }

    const previous = result[index]!;

    result[index] = {
      ...previous,
      clip:
        !previous.clip || !stroke.clip
          ? undefined
          : combinedMask(previous.clip, stroke.clip),
    };
  }

  return result;
}

export const FragmentGroups = { groupedStrokes };
