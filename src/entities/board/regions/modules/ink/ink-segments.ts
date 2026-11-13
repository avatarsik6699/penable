import { type Stroke, type Position } from "../../../board.types";
import { BoardSourceGeometry } from "../../../geometry";
import { type InkSegment } from "../../regions.types";
import { InkUtils } from "./ink.utils";

const segments = new WeakMap<Stroke["points"], Map<string, InkSegment[]>>();

function curveSegments(
  start: Position,
  control: Position,
  end: Position,
  result: InkSegment[],
  depth = 0,
): void {
  const error = InkUtils.curveError(start, control, end);

  // Derived query bounds only. The renderer still uses the exact original curve.
  if (error <= 0.01 || depth >= 24) {
    result.push({ a: start, b: end, error });

    return;
  }

  const a = InkUtils.midpoint(start, control),
    b = InkUtils.midpoint(control, end),
    mid = InkUtils.midpoint(a, b);

  curveSegments(start, a, mid, result, depth + 1);
  curveSegments(mid, b, end, result, depth + 1);
}

function sourceSegments(stroke: Stroke): InkSegment[] {
  const key = InkUtils.profileKey(stroke);
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

export const InkSegments = { sourceSegments };
