import { type Position } from "../board.types";
import { type StrokeGeometry } from "../geometry";
import { type Bounds } from "./hit-test.types";

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

export const HitTestQueries = { overlapsSweep, geometryHits };
