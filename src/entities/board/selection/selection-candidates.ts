import type { Stroke, Position } from "../board.types";
import type { SelectedPart } from "../regions";
import { SelectionUtils } from "./selection.utils";

function candidate(
  scene: readonly Stroke[],
  parts: readonly SelectedPart[],
  delta: Position,
  remove = false,
): {
  strokes: Stroke[];
  selected: Stroke[];
} {
  const byOriginal = new Map(parts.map((part) => [part.original, part]));
  const selected: Stroke[] = [];

  const strokes = scene.flatMap((stroke) => {
    const part = byOriginal.get(stroke);

    if (!part) return [stroke];

    const result: Stroke[] = [];

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
