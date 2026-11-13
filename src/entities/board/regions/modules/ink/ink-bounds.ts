import {
  type ClipMask,
  type BoardItem,
  type Position,
} from "../../../board.types";
import { BoardTransforms } from "../../../transforms";
import { type InkBounds, type InkSegment } from "../../regions.types";
import { InkUtils } from "./ink.utils";
import { RegionMask } from "../mask";
import { InkSegments } from "./ink-segments";

const clippedBoundsCache = new WeakMap<
  ClipMask,
  WeakMap<
    import("../../../board.types").Stroke["points"],
    Map<string, InkBounds | null>
  >
>();

const strokeBoundsCache = new WeakMap<BoardItem, InkBounds | null>();

const roughBoundsCache = new WeakMap<
  import("../../../board.types").Stroke["points"],
  Map<string, InkBounds | null>
>();

function sourceBounds(stroke: BoardItem): InkBounds | null {
  if (stroke.kind === "image")
    return {
      left: 0,
      top: 0,
      right: stroke.asset.width,
      bottom: stroke.asset.height,
    };

  if (strokeBoundsCache.has(stroke)) return strokeBoundsCache.get(stroke)!;

  const key = InkUtils.profileKey(stroke);
  let cache = roughBoundsCache.get(stroke.points);

  if (!cache) {
    cache = new Map();
    roughBoundsCache.set(stroke.points, cache);
  }

  if (cache.has(key)) {
    const result = cache.get(key)!;

    strokeBoundsCache.set(stroke, result);

    return result;
  }

  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;

  for (const point of stroke.points) {
    left = Math.min(left, point.x);
    right = Math.max(right, point.x);
    top = Math.min(top, point.y);
    bottom = Math.max(bottom, point.y);
  }

  const padding =
    stroke.width / 2 +
    (stroke.stabilization ? 3 / stroke.stabilization.captureZoom : 0);

  const result =
    left === Infinity
      ? null
      : {
          left: left - padding,
          top: top - padding,
          right: right + padding,
          bottom: bottom + padding,
        };

  cache.set(key, result);
  strokeBoundsCache.set(stroke, result);

  return result;
}

function circleIntersections(
  a: Position,
  b: Position,
  center: Position,
  radius: number,
  add: (p: Position) => void,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = Math.hypot(dx, dy);

  if (!length) return;

  const ux = dx / length,
    uy = dy / length;

  const x = center.x - a.x,
    y = center.y - a.y;

  const projection = x * ux + y * uy,
    perpendicular = x * uy - y * ux;

  if (Math.abs(perpendicular) > radius) return;

  const halfChord = Math.sqrt(
    Math.max(0, radius * radius - perpendicular * perpendicular),
  );

  // Construct around the circle, not a distant segment endpoint. Squared quadratic
  // coefficients lose the small discriminant for otherwise valid billion-unit edges.
  const foot = {
    x: center.x - perpendicular * uy,
    y: center.y + perpendicular * ux,
  };

  for (const distance of [-halfChord, halfChord])
    if (projection + distance >= 0 && projection + distance <= length) {
      add({ x: foot.x + ux * distance, y: foot.y + uy * distance });
    }
}

function lineIntersection(
  a: Position,
  b: Position,
  c: Position,
  d: Position,
  add: (p: Position) => void,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    ex = d.x - c.x,
    ey = d.y - c.y,
    denominator = dx * ey - dy * ex;

  if (!denominator) return;

  const t = ((c.x - a.x) * ey - (c.y - a.y) * ex) / denominator;
  const u = ((c.x - a.x) * dy - (c.y - a.y) * dx) / denominator;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1)
    add({ x: a.x + t * dx, y: a.y + t * dy });
}

// Extrema of capsule ∩ polygon occur at capsule cardinal/corner points inside the
// mask, mask vertices inside the capsule, or boundary intersections. No Boolean
// polygon construction is needed for a query bound (holes use the same boundary).
function clippedCapsuleBounds(
  segment: InkSegment,
  radius: number,
  mask: ClipMask,
  clipBounds: InkBounds,
): InkBounds | null {
  const r = radius + segment.error,
    bounds = InkUtils.segmentBounds(segment, radius);

  if (!InkUtils.overlaps(bounds, clipBounds)) return null;

  if (InkUtils.maskContainsBounds(mask, bounds)) return bounds;

  let result: InkBounds | null = null;

  const add = (p: Position) => {
    result = InkUtils.mergeBounds(result, {
      left: p.x,
      right: p.x,
      top: p.y,
      bottom: p.y,
    });
  };

  const inside = (p: Position) => {
    if (RegionMask.contains(mask, p)) add(p);
  };

  const { a, b } = segment,
    length = Math.hypot(b.x - a.x, b.y - a.y);

  const nx = length ? (-(b.y - a.y) / length) * r : r,
    ny = length ? ((b.x - a.x) / length) * r : 0;

  const sides = [
    [
      { x: a.x + nx, y: a.y + ny },
      { x: b.x + nx, y: b.y + ny },
    ],
    [
      { x: a.x - nx, y: a.y - ny },
      { x: b.x - nx, y: b.y - ny },
    ],
  ] as const;

  for (const center of [a, b])
    for (const point of [
      { x: center.x - r, y: center.y },
      { x: center.x + r, y: center.y },
      { x: center.x, y: center.y - r },
      { x: center.x, y: center.y + r },
    ])
      inside(point);

  for (const side of sides) {
    inside(side[0]);
    inside(side[1]);
  }

  for (const edge of RegionMask.maskEdges(mask)) {
    if (
      !InkUtils.overlaps(bounds, {
        left: Math.min(edge.a.x, edge.b.x),
        right: Math.max(edge.a.x, edge.b.x),
        top: Math.min(edge.a.y, edge.b.y),
        bottom: Math.max(edge.a.y, edge.b.y),
      })
    )
      continue;

    if (RegionMask.pointSegmentDistance(edge.a, a, b) <= r) add(edge.a);

    if (RegionMask.pointSegmentDistance(edge.b, a, b) <= r) add(edge.b);

    circleIntersections(edge.a, edge.b, a, r, add);
    circleIntersections(edge.a, edge.b, b, r, add);

    for (const side of sides)
      lineIntersection(edge.a, edge.b, side[0], side[1], add);
  }

  return result;
}

function localVisibleBounds(stroke: BoardItem): InkBounds | null {
  if (stroke.kind === "image") {
    const b = sourceBounds(stroke)!;
    const clip = stroke.clip ? RegionMask.maskBounds(stroke.clip) : null;

    return clip
      ? {
          left: Math.max(0, clip.left),
          top: Math.max(0, clip.top),
          right: Math.min(b.right, clip.right),
          bottom: Math.min(b.bottom, clip.bottom),
        }
      : b;
  }

  const key = InkUtils.profileKey(stroke);

  let pointsCache = stroke.clip
    ? clippedBoundsCache.get(stroke.clip)
    : undefined;

  if (stroke.clip && !pointsCache) {
    pointsCache = new WeakMap();
    clippedBoundsCache.set(stroke.clip, pointsCache);
  }

  let cache = pointsCache?.get(stroke.points);

  if (pointsCache && !cache) {
    cache = new Map();
    pointsCache.set(stroke.points, cache);
  }

  if (cache?.has(key)) return cache.get(key)!;

  const clipBounds = stroke.clip ? RegionMask.maskBounds(stroke.clip) : null;
  let result: InkBounds | null = null;

  for (const segment of InkSegments.sourceSegments(stroke)) {
    const bounds =
      stroke.clip && clipBounds
        ? clippedCapsuleBounds(
            segment,
            stroke.width / 2,
            stroke.clip,
            clipBounds,
          )
        : InkUtils.segmentBounds(segment, stroke.width / 2);

    if (bounds) result = InkUtils.mergeBounds(result, bounds);
  }

  cache?.set(key, result);

  return result;
}

function visibleBounds(strokes: readonly BoardItem[]): InkBounds | null {
  let result: InkBounds | null = null;

  for (const stroke of strokes) {
    const bounds = localVisibleBounds(stroke),
      offset = stroke.translation ?? { x: 0, y: 0 };

    if (bounds)
      result = InkUtils.mergeBounds(
        result,
        stroke.matrix
          ? BoardTransforms.bounds(bounds, stroke.matrix)
          : {
              left: bounds.left + offset.x,
              right: bounds.right + offset.x,
              top: bounds.top + offset.y,
              bottom: bounds.bottom + offset.y,
            },
      );
  }

  return result;
}

export const InkBoundsQueries = { sourceBounds, visibleBounds };
