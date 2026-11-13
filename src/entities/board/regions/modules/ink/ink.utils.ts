import {
  type Stroke,
  type Position,
  type ClipMask,
} from "../../../board.types";
import { type InkBounds, type InkSegment } from "../../regions.types";
import { RegionMask } from "../mask";

const profileKey = (stroke: Stroke) =>
  JSON.stringify([stroke.width, stroke.stabilization]);

function overlaps(a: InkBounds, b: InkBounds): boolean {
  return (
    a.left <= b.right &&
    a.right >= b.left &&
    a.top <= b.bottom &&
    a.bottom >= b.top
  );
}

function curveError(start: Position, control: Position, end: Position): number {
  return (
    Math.hypot(
      start.x - 2 * control.x + end.x,
      start.y - 2 * control.y + end.y,
    ) / 4
  );
}

function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function segmentBounds(segment: InkSegment, radius: number): InkBounds {
  const r = radius + segment.error;

  return {
    left: Math.min(segment.a.x, segment.b.x) - r,
    right: Math.max(segment.a.x, segment.b.x) + r,
    top: Math.min(segment.a.y, segment.b.y) - r,
    bottom: Math.max(segment.a.y, segment.b.y) + r,
  };
}

function mergeBounds(a: InkBounds | null, b: InkBounds): InkBounds {
  return a
    ? {
        left: Math.min(a.left, b.left),
        top: Math.min(a.top, b.top),
        right: Math.max(a.right, b.right),
        bottom: Math.max(a.bottom, b.bottom),
      }
    : b;
}

function maskContainsBounds(mask: ClipMask, bounds: InkBounds): boolean {
  const outer = RegionMask.maskBounds(mask);

  if (
    !outer ||
    outer.left > bounds.left ||
    outer.right < bounds.right ||
    outer.top > bounds.top ||
    outer.bottom < bounds.bottom
  )
    return false;

  if (
    mask.length === 1 &&
    mask[0]!.length === 1 &&
    mask[0]![0]!.length === 5 &&
    mask[0]![0]!.every(
      ([x, y], index, ring) =>
        !index || x === ring[index - 1]![0] || y === ring[index - 1]![1],
    )
  )
    return true;

  if (
    ![
      { x: bounds.left, y: bounds.top },
      { x: bounds.right, y: bounds.top },
      { x: bounds.right, y: bounds.bottom },
      { x: bounds.left, y: bounds.bottom },
    ].every((p) => RegionMask.contains(mask, p))
  )
    return false;

  // A hole or concave notch wholly inside the box also disqualifies containment.
  return !RegionMask.maskEdges(mask).some(({ a, b }) =>
    overlaps(bounds, {
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    }),
  );
}

export const InkUtils = {
  curveError,
  midpoint,
  profileKey,
  segmentBounds,
  overlaps,
  maskContainsBounds,
  mergeBounds,
};
