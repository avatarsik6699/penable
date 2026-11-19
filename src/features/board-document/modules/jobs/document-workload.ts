import { DocumentJobConfig } from "./document-jobs.config";
import type { BoardItem, RegionInput, TextItem } from "~/entities/board";
import { BoardRegions, BoardTemplates } from "~/entities/board";

function textUnits(text: TextItem): number {
  return text.text.length + text.lines.length * 4;
}

function heavyDocument(
  strokes: readonly BoardItem[],
  region?: RegionInput,
): boolean {
  if (
    strokes.length > DocumentJobConfig.heavyStrokes ||
    (region?.shape === "lasso" &&
      region.points.length > DocumentJobConfig.heavyLassoVertices)
  )
    return true;

  let points = 0,
    vertices = 0,
    imageBytes = 0,
    text = 0;

  const assets = new Set<import("~/entities/board").ImageAsset>();

  for (const stroke of strokes) {
    if (stroke.kind === "image" && !assets.has(stroke.asset)) {
      assets.add(stroke.asset);
      imageBytes += stroke.asset.base64.length;

      if (imageBytes >= 128 * 1024) return true;
    }

    if (stroke.kind === "template")
      points += BoardTemplates.workload(
        stroke.template,
        stroke.generatorVersion,
      );
    else if (stroke.kind === "text") text += textUnits(stroke);
    else if (stroke.kind !== "image") points += stroke.points.length;

    vertices += stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0;

    if (
      points > DocumentJobConfig.heavyPoints ||
      vertices > DocumentJobConfig.heavyMaskVertices ||
      text >= DocumentJobConfig.heavyTextUnits
    )
      return true;
  }

  return false;
}

export const DocumentWorkload = { heavyDocument, textUnits };
