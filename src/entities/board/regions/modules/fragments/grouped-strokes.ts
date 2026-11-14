import { BoardCompositing } from "../../../compositing";
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

  const ordered = BoardCompositing.orderSensitive(strokes);

  for (const stroke of strokes) {
    if (ordered) {
      const previous = result.at(-1);

      const key = (item: BoardItem) =>
        `${item.kind ?? "ink"}:${item.kind === "template" ? item.generatorVersion : ""}:${item.source}:${item.matrix?.join(":") ?? `${item.translation?.x ?? 0}:${item.translation?.y ?? 0}`}`;

      if (previous?.source && stroke.source && key(previous) === key(stroke))
        result[result.length - 1] = {
          ...previous,
          clip:
            !previous.clip || !stroke.clip
              ? undefined
              : combinedMask(previous.clip, stroke.clip),
        };
      else result.push(stroke);

      continue;
    }

    if (!stroke.source) {
      if (stroke.kind === "image") groups.clear();

      result.push(stroke);
      continue;
    }

    const offset = stroke.translation ?? { x: 0, y: 0 };
    const key = `${stroke.kind ?? "ink"}:${stroke.kind === "template" ? stroke.generatorVersion : ""}:${stroke.source}:${stroke.matrix?.join(":") ?? `${offset.x}:${offset.y}`}`;

    if (stroke.kind === "image") {
      groups.clear();

      const previous = result.at(-1);
      const previousOffset = previous?.translation ?? { x: 0, y: 0 };

      const previousKey = previous
        ? `${previous.kind ?? "ink"}:${previous.kind === "template" ? previous.generatorVersion : ""}:${previous.source}:${previous.matrix?.join(":") ?? `${previousOffset.x}:${previousOffset.y}`}`
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
