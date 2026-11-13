import { RegionConfig } from "./regions.config";
import { FragmentLineage } from "./modules/fragments";
import { RegionMask } from "./modules/mask";
import { InkBoundsQueries } from "./modules/ink";
import { InkIntersections } from "./modules/ink";
import { FragmentSelection } from "./modules/fragments";
import { FragmentGroups } from "./modules/fragments";

export const BoardRegions = {
  REGION_LIMITS: RegionConfig.REGION_LIMITS,
  newSource: FragmentLineage.newSource,
  sourceOf: FragmentLineage.sourceOf,
  cloneMask: RegionMask.cloneMask,
  vertexCount: RegionMask.vertexCount,
  normalizeMask: RegionMask.normalizeMask,
  rectangle: RegionMask.rectangle,
  lasso: RegionMask.lasso,
  translateMask: RegionMask.translateMask,
  maskBounds: RegionMask.maskBounds,
  capsule: RegionMask.capsule,
  pointSegmentDistance: RegionMask.pointSegmentDistance,
  sourceBounds: InkBoundsQueries.sourceBounds,
  inkIntersectsMask: InkIntersections.inkIntersectsMask,
  visibleBounds: InkBoundsQueries.visibleBounds,
  contains: RegionMask.contains,
  selectParts: FragmentSelection.selectParts,
  groupedStrokes: FragmentGroups.groupedStrokes,
};

export type { InkBounds, SelectedPart } from "./regions.types";
