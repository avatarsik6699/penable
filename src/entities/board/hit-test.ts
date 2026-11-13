import { intersection } from "polygon-clipping";
import { BoardRegions } from "./regions";
import { type StrokeGeometry, BoardGeometry } from "./geometry";
import { BoardStabilization } from "./stabilization";
import type { Position, Stroke } from "./types";

const ERASER_RADIUS = 8;
const CURVE_TOLERANCE = 0.125;

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type CachedStroke = {
  bounds: Bounds;
  geometry?: StrokeGeometry;
};

function pointDistanceSquared(
  point: Position,
  start: Position,
  end: Position,
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = dx * dx + dy * dy;

  const t = length
    ? Math.max(
        0,
        Math.min(
          1,
          ((point.x - start.x) * dx + (point.y - start.y) * dy) / length,
        ),
      )
    : 0;

  return (point.x - start.x - t * dx) ** 2 + (point.y - start.y - t * dy) ** 2;
}

function cross(a: Position, b: Position, c: Position): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentDistanceSquared(
  a: Position,
  b: Position,
  c: Position,
  d: Position,
): number {
  const ac = cross(a, b, c);
  const ad = cross(a, b, d);
  const ca = cross(c, d, a);
  const cb = cross(c, d, b);

  // Strict intersection; touching/collinear/degenerate cases use endpoint distances below.
  if (
    ((ac < 0 && ad > 0) || (ac > 0 && ad < 0)) &&
    ((ca < 0 && cb > 0) || (ca > 0 && cb < 0))
  )
    return 0;

  return Math.min(
    pointDistanceSquared(a, c, d),
    pointDistanceSquared(b, c, d),
    pointDistanceSquared(c, a, b),
    pointDistanceSquared(d, a, b),
  );
}

function midpoint(a: Position, b: Position): Position {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function overlapsSweep(
  bounds: Bounds,
  from: Position,
  to: Position,
  radius: number,
): boolean {
  return (
    Math.max(from.x, to.x) + radius >= bounds.left &&
    Math.min(from.x, to.x) - radius <= bounds.right &&
    Math.max(from.y, to.y) + radius >= bounds.top &&
    Math.min(from.y, to.y) - radius <= bounds.bottom
  );
}

function curveHits(
  start: Position,
  control: Position,
  end: Position,
  from: Position,
  to: Position,
  radius: number,
  tolerance: number,
): boolean {
  // Reject each control hull before subdivision; a distant valid curve need not become a huge polyline.
  if (
    !overlapsSweep(
      {
        left: Math.min(start.x, control.x, end.x),
        right: Math.max(start.x, control.x, end.x),
        top: Math.min(start.y, control.y, end.y),
        bottom: Math.max(start.y, control.y, end.y),
      },
      from,
      to,
      radius,
    )
  )
    return false;

  // The chord error also detects a collinear curve which doubles back beyond its endpoints.
  const error =
    Math.hypot(
      start.x - 2 * control.x + end.x,
      start.y - 2 * control.y + end.y,
    ) / 4;

  const distanceSquared = segmentDistanceSquared(from, to, start, end);

  if (distanceSquared > (radius + error) ** 2) return false;

  if (error <= tolerance) return distanceSquared <= radius * radius;

  if (radius >= error && distanceSquared <= (radius - error) ** 2) return true;

  const left = midpoint(start, control);
  const right = midpoint(control, end);
  const center = midpoint(left, right);

  return (
    curveHits(start, left, center, from, to, radius, tolerance) ||
    curveHits(center, right, end, from, to, radius, tolerance)
  );
}

function geometryHits(
  geometry: StrokeGeometry,
  from: Position,
  to: Position,
  radius: number,
  tolerance: number,
): boolean {
  if (geometry.kind === "empty") return false;

  if (geometry.kind === "dot")
    return pointDistanceSquared(geometry, from, to) <= radius * radius;

  let previous: Position | undefined;

  for (const command of geometry.commands) {
    if (
      previous &&
      command.kind === "line" &&
      segmentDistanceSquared(from, to, previous, command) <= radius * radius
    )
      return true;

    if (
      previous &&
      command.kind === "quadratic" &&
      curveHits(
        previous,
        { x: command.cx, y: command.cy },
        command,
        from,
        to,
        radius,
        tolerance,
      )
    )
      return true;

    previous = command;
  }

  return false;
}

// One instance per gesture: references, rather than reusable numeric IDs, key derived geometry.
export class StrokeHitTester {
  private readonly cache = new WeakMap<Stroke, CachedStroke>();

  constructor(private readonly zoom: number) {}

  hits(stroke: Stroke, from: Position, to: Position): boolean {
    if (stroke.clip || stroke.translation) {
      const offset = stroke.translation ?? { x: 0, y: 0 };

      const localFrom = { x: from.x - offset.x, y: from.y - offset.y },
        localTo = { x: to.x - offset.x, y: to.y - offset.y };

      const radius = ERASER_RADIUS / this.zoom,
        source = BoardRegions.sourceBounds(stroke),
        clip = stroke.clip ? BoardRegions.maskBounds(stroke.clip) : null;

      if (
        !source ||
        !overlapsSweep(source, localFrom, localTo, radius) ||
        (stroke.clip &&
          (!clip || !overlapsSweep(clip, localFrom, localTo, radius)))
      )
        return false;

      const sweep = BoardRegions.capsule(localFrom, localTo, radius);

      return BoardRegions.inkIntersectsMask(
        stroke,
        stroke.clip ? intersection(stroke.clip, sweep) : sweep,
      );
    }

    let cached = this.cache.get(stroke);

    if (!cached) {
      const bounds: Bounds = {
        left: Infinity,
        top: Infinity,
        right: -Infinity,
        bottom: -Infinity,
      };

      for (const point of stroke.points) {
        bounds.left = Math.min(bounds.left, point.x);
        bounds.top = Math.min(bounds.top, point.y);
        bounds.right = Math.max(bounds.right, point.x);
        bounds.bottom = Math.max(bounds.bottom, point.y);
      }

      // Stabilization is capped at three capture-time CSS pixels; curves stay in the control hull.
      const deviation = stroke.stabilization
        ? 3 / stroke.stabilization.captureZoom
        : 0;

      bounds.left -= deviation;
      bounds.top -= deviation;
      bounds.right += deviation;
      bounds.bottom += deviation;
      cached = { bounds };
      this.cache.set(stroke, cached);
    }

    const radius = ERASER_RADIUS / this.zoom + stroke.width / 2;
    const { bounds } = cached;

    if (!overlapsSweep(bounds, from, to, radius)) return false;

    cached.geometry ??= BoardGeometry.strokeGeometry(
      BoardStabilization.stabilizedPositions(
        stroke.points,
        stroke.stabilization,
      ),
      stroke.width,
    );

    return geometryHits(
      cached.geometry,
      from,
      to,
      radius,
      CURVE_TOLERANCE / this.zoom,
    );
  }
}

export const BoardHitTest = { ERASER_RADIUS };
