import {
  difference,
  intersection,
  union,
  type MultiPolygon,
  type Pair,
} from "polygon-clipping";
import { BoardSourceGeometry } from "./source-geometry";
import type { ClipMask, Position, Stroke } from "./types";

const REGION_LIMITS = { lasso: 2048, mask: 8192, document: 100000 };

export type InkBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

const lineages = new WeakMap<Stroke, string>();
let sequence = 0;
const namespace = Math.random().toString(36).slice(2);

function newSource(): string {
  return `source-${namespace}-${++sequence}`;
}

function sourceOf(stroke: Stroke): string {
  if (stroke.source) return stroke.source;

  let source = lineages.get(stroke);

  if (!source) {
    source = newSource();
    lineages.set(stroke, source);
  }

  return source;
}

function cloneMask(mask: ClipMask): ClipMask {
  return mask.map((p) => p.map((r) => r.map(([x, y]) => [x, y])));
}

function vertexCount(mask: ClipMask): number {
  return mask.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0);
}

function normalizeMask(mask: ClipMask): ClipMask {
  const normalized = union(mask);

  if (vertexCount(normalized) > REGION_LIMITS.mask)
    throw new Error("Слишком сложная граница: предел 8192 вершин на фрагмент.");

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
  if (points.length > REGION_LIMITS.lasso)
    throw new Error(
      "Лассо: предел 2048 вершин. Попробуйте более короткую границу.",
    );

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

type InkSegment = {
  a: Position;
  b: Position;
  error: number;
};

type MaskEdge = {
  a: Position;
  b: Position;
};

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

const segments = new WeakMap<Stroke["points"], Map<string, InkSegment[]>>();

const clippedBoundsCache = new WeakMap<
  ClipMask,
  WeakMap<Stroke["points"], Map<string, InkBounds | null>>
>();

const strokeBoundsCache = new WeakMap<Stroke, InkBounds | null>();

const roughBoundsCache = new WeakMap<
  Stroke["points"],
  Map<string, InkBounds | null>
>();

const profileKey = (stroke: Stroke) =>
  JSON.stringify([stroke.width, stroke.stabilization]);

function sourceBounds(stroke: Stroke): InkBounds | null {
  if (strokeBoundsCache.has(stroke)) return strokeBoundsCache.get(stroke)!;

  const key = profileKey(stroke);
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

function curveSegments(
  start: Position,
  control: Position,
  end: Position,
  result: InkSegment[],
  depth = 0,
): void {
  const error = curveError(start, control, end);

  // Derived query bounds only. The renderer still uses the exact original curve.
  if (error <= 0.01 || depth >= 24) {
    result.push({ a: start, b: end, error });

    return;
  }

  const a = midpoint(start, control),
    b = midpoint(control, end),
    mid = midpoint(a, b);

  curveSegments(start, a, mid, result, depth + 1);
  curveSegments(mid, b, end, result, depth + 1);
}

function sourceSegments(stroke: Stroke): InkSegment[] {
  const key = profileKey(stroke);
  const cache = segments.get(stroke.points) ?? new Map<string, InkSegment[]>();
  const cached = cache.get(key);

  if (cached) return cached;

  const geometry = BoardSourceGeometry.sourceGeometry(stroke),
    result: InkSegment[] = [];

  if (geometry.kind === "dot")
    result.push({ a: geometry, b: geometry, error: 0 });

  if (geometry.kind === "path") {
    let previous: Position | null = null;

    for (const command of geometry.commands) {
      if (previous && command.kind === "quadratic")
        curveSegments(
          previous,
          { x: command.cx, y: command.cy },
          command,
          result,
        );
      else if (previous && command.kind === "line")
        result.push({ a: previous, b: command, error: 0 });

      previous = command;
    }
  }

  cache.set(key, result);
  segments.set(stroke.points, cache);

  return result;
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

function chordDistance(a: Position, b: Position, mask: ClipMask): number {
  let distance = Infinity;

  for (const edge of maskEdges(mask)) {
    distance = Math.min(distance, segmentDistance(a, b, edge.a, edge.b));

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
  const error = curveError(start, control, end);

  if (!overlaps(bounds, segmentBounds({ a: start, b: end, error }, radius)))
    return false;

  if (contains(mask, start) || contains(mask, end)) return true;

  const distance = chordDistance(start, end, mask);

  if (distance > radius + error) return false;

  if (error <= 0.0001 || depth >= 24 || distance <= radius - error) return true;

  const a = midpoint(start, control),
    b = midpoint(control, end),
    mid = midpoint(a, b);

  return (
    curveIntersects(start, a, mid, radius, mask, bounds, depth + 1) ||
    curveIntersects(mid, b, end, radius, mask, bounds, depth + 1)
  );
}

function inkIntersectsMask(stroke: Stroke, mask: ClipMask): boolean {
  const bounds = maskBounds(mask),
    source = sourceBounds(stroke);

  if (!bounds || !source || !overlaps(bounds, source)) return false;

  const geometry = BoardSourceGeometry.sourceGeometry(stroke),
    radius = stroke.width / 2;

  if (geometry.kind === "dot")
    return (
      contains(mask, geometry) ||
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
        overlaps(
          bounds,
          segmentBounds({ a: previous, b: command, error: 0 }, radius),
        ) &&
        (contains(mask, previous) ||
          contains(mask, command) ||
          chordDistance(previous, command, mask) <= radius)
      )
        return true;

      previous = command;
    }
  }

  return false;
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
    bounds = segmentBounds(segment, radius);

  if (!overlaps(bounds, clipBounds)) return null;

  if (maskContainsBounds(mask, bounds)) return bounds;

  let result: InkBounds | null = null;

  const add = (p: Position) => {
    result = mergeBounds(result, {
      left: p.x,
      right: p.x,
      top: p.y,
      bottom: p.y,
    });
  };

  const inside = (p: Position) => {
    if (contains(mask, p)) add(p);
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

  for (const edge of maskEdges(mask)) {
    if (
      !overlaps(bounds, {
        left: Math.min(edge.a.x, edge.b.x),
        right: Math.max(edge.a.x, edge.b.x),
        top: Math.min(edge.a.y, edge.b.y),
        bottom: Math.max(edge.a.y, edge.b.y),
      })
    )
      continue;

    if (pointSegmentDistance(edge.a, a, b) <= r) add(edge.a);

    if (pointSegmentDistance(edge.b, a, b) <= r) add(edge.b);

    circleIntersections(edge.a, edge.b, a, r, add);
    circleIntersections(edge.a, edge.b, b, r, add);

    for (const side of sides)
      lineIntersection(edge.a, edge.b, side[0], side[1], add);
  }

  return result;
}

function localVisibleBounds(stroke: Stroke): InkBounds | null {
  const key = profileKey(stroke);

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

  const clipBounds = stroke.clip ? maskBounds(stroke.clip) : null;
  let result: InkBounds | null = null;

  for (const segment of sourceSegments(stroke)) {
    const bounds =
      stroke.clip && clipBounds
        ? clippedCapsuleBounds(
            segment,
            stroke.width / 2,
            stroke.clip,
            clipBounds,
          )
        : segmentBounds(segment, stroke.width / 2);

    if (bounds) result = mergeBounds(result, bounds);
  }

  cache?.set(key, result);

  return result;
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

function visibleBounds(strokes: readonly Stroke[]): InkBounds | null {
  let result: InkBounds | null = null;

  for (const stroke of strokes) {
    const bounds = localVisibleBounds(stroke),
      offset = stroke.translation ?? { x: 0, y: 0 };

    if (bounds)
      result = mergeBounds(result, {
        left: bounds.left + offset.x,
        right: bounds.right + offset.x,
        top: bounds.top + offset.y,
        bottom: bounds.bottom + offset.y,
      });
  }

  return result;
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

function maskContainsBounds(mask: ClipMask, bounds: InkBounds): boolean {
  const outer = maskBounds(mask);

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
    ].every((p) => contains(mask, p))
  )
    return false;

  // A hole or concave notch wholly inside the box also disqualifies containment.
  return !maskEdges(mask).some(({ a, b }) =>
    overlaps(bounds, {
      left: Math.min(a.x, b.x),
      right: Math.max(a.x, b.x),
      top: Math.min(a.y, b.y),
      bottom: Math.max(a.y, b.y),
    }),
  );
}

function checkedMask(mask: ClipMask): ClipMask {
  if (vertexCount(mask) > REGION_LIMITS.mask)
    throw new Error("Слишком сложная граница: предел 8192 вершин на фрагмент.");

  return mask;
}

export type SelectedPart = {
  original: Stroke;
  selected: Stroke;
  remainder: Stroke | null;
};

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
      localRegion = translateMask(region, { x: -offset.x, y: -offset.y });
      translated.set(key, localRegion);
    }

    const source = sourceBounds(stroke),
      regionBounds = maskBounds(localRegion);

    if (!source || !regionBounds || !overlaps(source, regionBounds)) continue;

    if (maskContainsBounds(localRegion, source)) {
      if (!stroke.clip || inkIntersectsMask(stroke, stroke.clip))
        result.push({ original: stroke, selected: stroke, remainder: null });

      continue;
    }

    // An enclosing box keeps the original exact painted boundary; polygonized ink is
    // never substituted for the source curve or used as the rendered clipping edge.
    const bounds = source;

    const outer =
      stroke.clip ??
      rectangle(
        { x: bounds.left - 1, y: bounds.top - 1 },
        { x: bounds.right + 1, y: bounds.bottom + 1 },
      );

    const selectedClip = checkedMask(intersection(outer, localRegion));

    if (!inkIntersectsMask(stroke, selectedClip)) continue;

    const remainderClip = checkedMask(difference(outer, localRegion));

    const common = {
      ...stroke,
      source: sourceOf(stroke),
      translation: { ...offset },
    };

    const selected = { ...common, clip: selectedClip };
    const remainingInk = inkIntersectsMask(stroke, remainderClip);

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

const unionCache = new WeakMap<ClipMask, WeakMap<ClipMask, ClipMask>>();

function combinedMask(a: ClipMask, b: ClipMask): ClipMask {
  let cache = unionCache.get(a);

  if (!cache) {
    cache = new WeakMap();
    unionCache.set(a, cache);
  }

  let result = cache.get(b);

  if (!result) {
    result = union(a, b);
    cache.set(b, result);
  }

  return result;
}

function groupedStrokes(strokes: readonly Stroke[]): Stroke[] {
  const result: Stroke[] = [],
    groups = new Map<string, number>();

  for (const stroke of strokes) {
    if (!stroke.source) {
      result.push(stroke);
      continue;
    }

    const offset = stroke.translation ?? { x: 0, y: 0 };
    const key = `${stroke.source}:${offset.x}:${offset.y}`;
    const index = groups.get(key);

    if (index === undefined) {
      groups.set(key, result.length);
      result.push(stroke);
      continue;
    }

    const previous = result[index]!;

    result[index] = {
      ...previous,
      clip:
        !previous.clip || !stroke.clip
          ? undefined
          : combinedMask(previous.clip, stroke.clip),
    };
  }

  return result;
}

export const BoardRegions = {
  REGION_LIMITS,
  newSource,
  sourceOf,
  cloneMask,
  vertexCount,
  normalizeMask,
  rectangle,
  lasso,
  translateMask,
  maskBounds,
  capsule,
  pointSegmentDistance,
  sourceBounds,
  inkIntersectsMask,
  visibleBounds,
  contains,
  selectParts,
  groupedStrokes,
};
