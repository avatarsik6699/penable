import { Messages } from "~/shared/lib/messages";
import { type ClipMask, type Position } from "../../../board.types";
import { union, type MultiPolygon, type Pair } from "polygon-clipping";
import { RegionConfig } from "../../regions.config";
import { type InkBounds, type MaskEdge } from "../../regions.types";

function cloneMask(mask: ClipMask): ClipMask {
  return mask.map((p) => p.map((r) => r.map(([x, y]) => [x, y])));
}

function vertexCount(mask: ClipMask): number {
  return mask.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
}

function normalizeMask(mask: ClipMask): ClipMask {
  const normalized = union(mask);

  if (vertexCount(normalized) > RegionConfig.REGION_LIMITS.mask)
    throw Messages.error(
      Messages.create("tooManyBoundaryVerticesLimit8192Per"),
    );

  return normalized;
}

function rectangle(a: Position, b: Position): ClipMask {
  if (a.x === b.x || a.y === b.y) return [];

  const left = Math.min(a.x, b.x),
    right = Math.max(a.x, b.x),
    top = Math.min(a.y, b.y),
    bottom = Math.max(a.y, b.y);

  return [
    [
      [
        [left, top],
        [right, top],
        [right, bottom],
        [left, bottom],
        [left, top],
      ],
    ],
  ];
}

function lasso(points: readonly Position[]): ClipMask {
  if (points.length > RegionConfig.REGION_LIMITS.lasso)
    throw Messages.error(Messages.create("lassoLimit2048VerticesTryAShorter"));

  if (points.length < 3) return [];

  return normalizeMask([[points.map((p) => [p.x, p.y])]]);
}

function translateMask(mask: ClipMask, offset: Position): ClipMask {
  if (!offset.x && !offset.y) return mask;

  return mask.map((p) =>
    p.map((r) => r.map(([x, y]) => [x + offset.x, y + offset.y])),
  );
}

const maskBoundsCache = new WeakMap<ClipMask, InkBounds | null>();

function maskBounds(mask: ClipMask): InkBounds | null {
  if (maskBoundsCache.has(mask)) return maskBoundsCache.get(mask)!;

  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;

  for (const polygon of mask)
    for (const ring of polygon)
      for (const [x, y] of ring) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }

  const result = left === Infinity ? null : { left, top, right, bottom };

  maskBoundsCache.set(mask, result);

  return result;
}

function circle(center: Position, radius: number): MultiPolygon {
  const count = 64,
    outerRadius = radius / Math.cos(Math.PI / count);

  const ring: Pair[] = [];

  // Tangent polygon, never inscribed: analytic hit tests below decide membership.
  for (let i = 0; i < count; i++) {
    const angle = ((i + 0.5) * Math.PI * 2) / count;

    ring.push([
      center.x + outerRadius * Math.cos(angle),
      center.y + outerRadius * Math.sin(angle),
    ]);
  }

  ring.push([...ring[0]!]);

  return [[ring]];
}

function cross(a: Pair, b: Pair, c: Pair) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function capsule(from: Position, to: Position, radius: number): MultiPolygon {
  const points = [
    ...circle(from, radius)[0]![0]!.slice(0, -1),
    ...circle(to, radius)[0]![0]!.slice(0, -1),
  ].sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const lower: Pair[] = [],
    upper: Pair[] = [];

  for (const p of points) {
    while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0)
      lower.pop();

    lower.push(p);
  }

  for (const p of points.reverse()) {
    while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0)
      upper.pop();

    upper.push(p);
  }

  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)];

  ring.push([...ring[0]!]);

  return [[ring]];
}

function pointSegmentDistance(
  point: Position,
  a: Position,
  b: Position,
): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    squared = dx * dx + dy * dy;

  const t = squared
    ? Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared),
      )
    : 0;

  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function segmentDistance(
  a: Position,
  b: Position,
  c: Position,
  d: Position,
): number {
  const side = (p: Position, q: Position, r: Position) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0)
    return 0;

  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

const maskEdgesCache = new WeakMap<ClipMask, MaskEdge[]>();

function maskEdges(mask: ClipMask): MaskEdge[] {
  let edges = maskEdgesCache.get(mask);

  if (!edges) {
    edges = [];

    for (const polygon of mask)
      for (const ring of polygon)
        for (let i = 1; i < ring.length; i++) {
          const a = ring[i - 1]!,
            b = ring[i]!;

          edges.push({ a: { x: a[0], y: a[1] }, b: { x: b[0], y: b[1] } });
        }

    maskEdgesCache.set(mask, edges);
  }

  return edges;
}

function contains(mask: ClipMask, point: Position): boolean {
  // Nonzero winding includes holes and the same semantics as Canvas clip/fill.
  let winding = 0;

  for (const polygon of mask)
    for (const ring of polygon)
      for (let i = 0; i < ring.length - 1; i++) {
        const a = ring[i]!,
          b = ring[i + 1]!;

        const cross =
          (b[0] - a[0]) * (point.y - a[1]) - (point.x - a[0]) * (b[1] - a[1]);

        if (a[1] <= point.y && b[1] > point.y && cross > 0) winding++;

        if (a[1] > point.y && b[1] <= point.y && cross < 0) winding--;
      }

  return winding !== 0;
}

function checkedMask(mask: ClipMask): ClipMask {
  if (vertexCount(mask) > RegionConfig.REGION_LIMITS.mask)
    throw Messages.error(
      Messages.create("tooManyBoundaryVerticesLimit8192Per"),
    );

  return mask;
}

export const RegionMask = {
  maskBounds,
  contains,
  maskEdges,
  pointSegmentDistance,
  segmentDistance,
  translateMask,
  rectangle,
  checkedMask,
  cloneMask,
  vertexCount,
  normalizeMask,
  lasso,
  capsule,
};
