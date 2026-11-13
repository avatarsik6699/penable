import {
  type Stroke,
  type Position,
  type RegionInput,
  type ClipMask,
} from "../board.types";
import { BoardRegions, type SelectedPart } from "../regions";
import { BoardIds } from "../stroke-ids";
import { SelectionConfig } from "./selection.config";

function shifted(stroke: Stroke, delta: Position): Stroke {
  if (!delta.x && !delta.y) return stroke;

  const offset = stroke.translation ?? SelectionConfig.ZERO;

  return {
    ...stroke,
    source: BoardRegions.sourceOf(stroke),
    translation: { x: offset.x + delta.x, y: offset.y + delta.y },
  };
}

function copy(strokes: readonly Stroke[]): Stroke[] {
  return [...strokes];
}

function prepareSelection(
  strokes: readonly Stroke[],
  input: RegionInput,
): {
  region: ClipMask;
  parts: SelectedPart[];
} {
  const bounds =
    input.shape === "all" ? BoardRegions.visibleBounds(strokes) : null;

  const region =
    input.shape === "all"
      ? bounds
        ? BoardRegions.rectangle(
            { x: bounds.left, y: bounds.top },
            { x: bounds.right, y: bounds.bottom },
          )
        : []
      : input.shape === "rectangle"
        ? BoardRegions.rectangle(input.points[0]!, input.points.at(-1)!)
        : BoardRegions.lasso(input.points);

  const parts =
    input.shape === "all"
      ? strokes.map((original) => ({
          original,
          selected: original,
          remainder: null,
        }))
      : BoardRegions.selectParts(
          strokes,
          region,
          BoardIds.createStrokeIdAllocator(strokes),
        );

  return { region, parts };
}

export const SelectionUtils = { shifted, prepareSelection, copy };
