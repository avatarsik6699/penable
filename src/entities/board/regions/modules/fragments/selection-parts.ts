import { type Stroke, type ClipMask } from "../../../board.types";
import { intersection, difference } from "polygon-clipping";
import { type SelectedPart } from "../../regions.types";
import { RegionMask } from "../mask";
import { InkBoundsQueries } from "../ink";
import { InkUtils } from "../ink";
import { InkIntersections } from "../ink";
import { FragmentLineage } from "./fragment-lineage";

function selectParts(
  strokes: readonly Stroke[],
  region: ClipMask,
  allocate: () => number,
): SelectedPart[] {
  const result: SelectedPart[] = [],
    translated = new Map<string, ClipMask>();

  for (const stroke of strokes) {
    const offset = stroke.translation ?? { x: 0, y: 0 };
    const key = `${offset.x}:${offset.y}`;
    let localRegion = translated.get(key);

    if (!localRegion) {
      localRegion = RegionMask.translateMask(region, {
        x: -offset.x,
        y: -offset.y,
      });

      translated.set(key, localRegion);
    }

    const source = InkBoundsQueries.sourceBounds(stroke),
      regionBounds = RegionMask.maskBounds(localRegion);

    if (!source || !regionBounds || !InkUtils.overlaps(source, regionBounds))
      continue;

    if (InkUtils.maskContainsBounds(localRegion, source)) {
      if (
        !stroke.clip ||
        InkIntersections.inkIntersectsMask(stroke, stroke.clip)
      )
        result.push({ original: stroke, selected: stroke, remainder: null });

      continue;
    }

    // An enclosing box keeps the original exact painted boundary; polygonized ink is
    // never substituted for the source curve or used as the rendered clipping edge.
    const bounds = source;

    const outer =
      stroke.clip ??
      RegionMask.rectangle(
        { x: bounds.left - 1, y: bounds.top - 1 },
        { x: bounds.right + 1, y: bounds.bottom + 1 },
      );

    const selectedClip = RegionMask.checkedMask(
      intersection(outer, localRegion),
    );

    if (!InkIntersections.inkIntersectsMask(stroke, selectedClip)) continue;

    const remainderClip = RegionMask.checkedMask(
      difference(outer, localRegion),
    );

    const common = {
      ...stroke,
      source: FragmentLineage.sourceOf(stroke),
      translation: { ...offset },
    };

    const selected = { ...common, clip: selectedClip };

    const remainingInk = InkIntersections.inkIntersectsMask(
      stroke,
      remainderClip,
    );

    result.push({
      original: stroke,
      selected,
      remainder: remainingInk
        ? { ...common, id: allocate(), clip: remainderClip }
        : null,
    });
  }

  return result;
}

export const FragmentSelection = { selectParts };
