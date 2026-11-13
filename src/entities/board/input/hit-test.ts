import { type Stroke, type Position } from "../board.types";
import { BoardTransforms } from "../transforms";
import { BoardRegions } from "../regions";
import { intersection } from "polygon-clipping";
import { BoardGeometry, BoardStabilization } from "../geometry";
import { type Bounds, type CachedStroke } from "./hit-test.types";
import { HitTestConfig } from "./hit-test.config";
import { HitTestQueries } from "./hit-test.utils";

// One instance per gesture: references, rather than reusable numeric IDs, key derived geometry.
export class StrokeHitTester {
  private readonly cache = new WeakMap<Stroke, CachedStroke>();

  constructor(private readonly zoom: number) {}

  hits(stroke: Stroke, from: Position, to: Position): boolean {
    if (stroke.matrix) {
      const sweep = BoardTransforms.mask(
        BoardRegions.capsule(from, to, HitTestConfig.ERASER_RADIUS / this.zoom),
        BoardTransforms.inverse(stroke.matrix),
      );

      return BoardRegions.inkIntersectsMask(
        stroke,
        stroke.clip ? intersection(stroke.clip, sweep) : sweep,
      );
    }

    if (stroke.clip || stroke.translation) {
      const offset = stroke.translation ?? { x: 0, y: 0 };

      const localFrom = { x: from.x - offset.x, y: from.y - offset.y },
        localTo = { x: to.x - offset.x, y: to.y - offset.y };

      const radius = HitTestConfig.ERASER_RADIUS / this.zoom,
        source = BoardRegions.sourceBounds(stroke),
        clip = stroke.clip ? BoardRegions.maskBounds(stroke.clip) : null;

      if (
        !source ||
        !HitTestQueries.overlapsSweep(source, localFrom, localTo, radius) ||
        (stroke.clip &&
          (!clip ||
            !HitTestQueries.overlapsSweep(clip, localFrom, localTo, radius)))
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

    const radius = HitTestConfig.ERASER_RADIUS / this.zoom + stroke.width / 2;
    const { bounds } = cached;

    if (!HitTestQueries.overlapsSweep(bounds, from, to, radius)) return false;

    cached.geometry ??= BoardGeometry.strokeGeometry(
      BoardStabilization.stabilizedPositions(
        stroke.points,
        stroke.stabilization,
      ),
      stroke.width,
    );

    return HitTestQueries.geometryHits(
      cached.geometry,
      from,
      to,
      radius,
      HitTestConfig.CURVE_TOLERANCE / this.zoom,
    );
  }
}

export const BoardHitTest = { ERASER_RADIUS: HitTestConfig.ERASER_RADIUS };
