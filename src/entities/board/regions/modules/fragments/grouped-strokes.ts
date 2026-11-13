import { type ClipMask, type BoardItem } from "../../../board.types";
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

function groupedStrokes(strokes: readonly BoardItem[]): BoardItem[] {
  const result: BoardItem[] = [],
    groups = new Map<string, number>();

  for (const stroke of strokes) {
    if (!stroke.source) {
      if (stroke.kind === "image") groups.clear();

      result.push(stroke);
      continue;
    }

    const offset = stroke.translation ?? { x: 0, y: 0 };
    const key = `${stroke.kind ?? "ink"}:${stroke.source}:${stroke.matrix?.join(":") ?? `${offset.x}:${offset.y}`}`;

    if (stroke.kind === "image") {
      groups.clear();

      const previous = result.at(-1);
      const previousOffset = previous?.translation ?? { x: 0, y: 0 };

      const previousKey = previous
        ? `${previous.kind ?? "ink"}:${previous.source}:${previous.matrix?.join(":") ?? `${previousOffset.x}:${previousOffset.y}`}`
        : "";

      if (
        previous?.kind === "image" &&
        previous.source &&
        previousKey === key
      ) {
        result[result.length - 1] = {
          ...previous,
          clip:
            !previous.clip || !stroke.clip
              ? undefined
              : combinedMask(previous.clip, stroke.clip),
        };
      } else result.push(stroke);

      continue;
    }

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
