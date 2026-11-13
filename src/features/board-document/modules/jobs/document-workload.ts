import { DocumentJobConfig } from "./document-jobs.config";
import type { Stroke, RegionInput } from "~/entities/board";
import { BoardRegions } from "~/entities/board";

function heavyDocument(
  strokes: readonly Stroke[],
  region?: RegionInput,
): boolean {
  if (
    strokes.length > DocumentJobConfig.heavyStrokes ||
    (region?.shape === "lasso" &&
      region.points.length > DocumentJobConfig.heavyLassoVertices)
  )
    return true;

  let points = 0,
    vertices = 0;

  for (const stroke of strokes) {
    points += stroke.points.length;
    vertices += stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0;

    if (
      points > DocumentJobConfig.heavyPoints ||
      vertices > DocumentJobConfig.heavyMaskVertices
    )
      return true;
  }

  return false;
}

export const DocumentWorkload = { heavyDocument };
