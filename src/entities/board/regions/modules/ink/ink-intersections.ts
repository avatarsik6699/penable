import {
  type Position,
  type ClipMask,
  type Stroke,
} from "../../../board.types";
import { BoardSourceGeometry } from "../../../geometry";
import { RegionMask } from "../mask";
import { type InkBounds } from "../../regions.types";
import { InkUtils } from "./ink.utils";
import { InkBoundsQueries } from "./ink-bounds";

function chordDistance(a: Position, b: Position, mask: ClipMask): number {
  let distance = Infinity;

  for (const edge of RegionMask.maskEdges(mask)) {
    distance = Math.min(
      distance,
      RegionMask.segmentDistance(a, b, edge.a, edge.b),
    );

    if (distance === 0) return 0;
  }

  return distance;
}

function curveIntersects(
  start: Position,
  control: Position,
  end: Position,
  radius: number,
  mask: ClipMask,
  bounds: InkBounds,
  depth = 0,
): boolean {
  const error = InkUtils.curveError(start, control, end);

  if (
    !InkUtils.overlaps(
      bounds,
      InkUtils.segmentBounds({ a: start, b: end, error }, radius),
    )
  )
    return false;

  if (RegionMask.contains(mask, start) || RegionMask.contains(mask, end))
    return true;

  const distance = chordDistance(start, end, mask);

  if (distance > radius + error) return false;

  if (error <= 0.0001 || depth >= 24 || distance <= radius - error) return true;

  const a = InkUtils.midpoint(start, control),
    b = InkUtils.midpoint(control, end),
    mid = InkUtils.midpoint(a, b);

  return (
    curveIntersects(start, a, mid, radius, mask, bounds, depth + 1) ||
    curveIntersects(mid, b, end, radius, mask, bounds, depth + 1)
  );
}

function inkIntersectsMask(stroke: Stroke, mask: ClipMask): boolean {
  const bounds = RegionMask.maskBounds(mask),
    source = InkBoundsQueries.sourceBounds(stroke);

  if (!bounds || !source || !InkUtils.overlaps(bounds, source)) return false;

  const geometry = BoardSourceGeometry.sourceGeometry(stroke),
    radius = stroke.width / 2;

  if (geometry.kind === "dot")
    return (
      RegionMask.contains(mask, geometry) ||
      chordDistance(geometry, geometry, mask) <= radius
    );

  if (geometry.kind === "path") {
    let previous: Position | null = null;

    for (const command of geometry.commands) {
      if (
        previous &&
        command.kind === "quadratic" &&
        curveIntersects(
          previous,
          { x: command.cx, y: command.cy },
          command,
          radius,
          mask,
          bounds,
        )
      )
        return true;

      if (
        previous &&
        command.kind === "line" &&
        InkUtils.overlaps(
          bounds,
          InkUtils.segmentBounds({ a: previous, b: command, error: 0 }, radius),
        ) &&
        (RegionMask.contains(mask, previous) ||
          RegionMask.contains(mask, command) ||
          chordDistance(previous, command, mask) <= radius)
      )
        return true;

      previous = command;
    }
  }

  return false;
}

export const InkIntersections = { inkIntersectsMask };
