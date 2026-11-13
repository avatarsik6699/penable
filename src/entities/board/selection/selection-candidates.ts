import type { BoardItem, Position } from "../board.types";
import type { SelectedPart } from "../regions";
import { SelectionUtils } from "./selection.utils";

function candidate(
  scene: readonly BoardItem[],
  parts: readonly SelectedPart[],
  delta: Position,
  remove = false,
): {
  strokes: BoardItem[];
  selected: BoardItem[];
} {
  const byOriginal = new Map(parts.map((part) => [part.original, part]));
  const selected: BoardItem[] = [];

  const strokes = scene.flatMap((stroke) => {
    const part = byOriginal.get(stroke);

    if (!part) return [stroke];

    const result: BoardItem[] = [];

    if (part.remainder) result.push(part.remainder);

    if (!remove) {
      const moved = SelectionUtils.shifted(part.selected, delta);

      selected.push(moved);
      result.push(moved);
    }

    return result;
  });

  return { strokes, selected };
}

export const SelectionCandidates = { candidate };
