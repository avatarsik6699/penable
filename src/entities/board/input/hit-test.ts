import { type Stroke, type Position, type ClipMask } from "../board.types";
import { BoardTransforms } from "../transforms";
import { BoardRegions } from "../regions";
import { intersection } from "polygon-clipping";
import { BoardGeometry, BoardStabilization } from "../geometry";
import { type CachedStroke } from "./hit-test.types";
import { HitTestConfig } from "./hit-test.config";
import { HitTestQueries } from "./hit-test.utils";

// One instance per gesture: references, rather than reusable numeric IDs, key derived geometry.
export class StrokeHitTester {
  private readonly cache = new WeakMap<Stroke, CachedStroke>();
  private lastSweep: { from: Position; to: Position; mask: ClipMask } | null =
    null;

  constructor(private readonly zoom: number) {}

  hits(stroke: Stroke, from: Position, to: Position): boolean {
    let cached = this.cache.get(stroke);

    if (!cached) {
      const source = BoardRegions.sourceBounds(stroke);
      const clip = stroke.clip ? BoardRegions.maskBounds(stroke.clip) : null;

      const local =
        source && (!stroke.clip || clip)
          ? {
              left: Math.max(source.left, clip?.left ?? -Infinity),
              top: Math.max(source.top, clip?.top ?? -Infinity),
              right: Math.min(source.right, clip?.right ?? Infinity),
              bottom: Math.min(source.bottom, clip?.bottom ?? Infinity),
            }
          : null;

      cached = {
        bounds:
          local && local.left <= local.right && local.top <= local.bottom
            ? BoardTransforms.bounds(local, BoardTransforms.matrix(stroke))
            : null,
      };

      this.cache.set(stroke, cached);
    }

    if (
      !cached.bounds ||
      !HitTestQueries.overlapsSweep(
        cached.bounds,
        from,
        to,
        HitTestConfig.ERASER_RADIUS / this.zoom,
      )
    )
      return false;

    if (
      stroke.matrix ||
      stroke.clip ||
      stroke.translation ||
      stroke.style?.instrument === "pressure"
    ) {
      const sweep = this.sweep(from, to);

      const local =
        stroke.matrix || stroke.translation
          ? BoardTransforms.mask(
              sweep,
              (cached.inverse ??= BoardTransforms.inverse(
                BoardTransforms.matrix(stroke),
              )),
            )
          : sweep;

      return BoardRegions.inkIntersectsMask(
        stroke,
        stroke.clip ? intersection(stroke.clip, local) : local,
      );
    }

    const radius = HitTestConfig.ERASER_RADIUS / this.zoom + stroke.width / 2;

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

  private sweep(from: Position, to: Position): ClipMask {
    const previous = this.lastSweep;

    if (
      previous &&
      previous.from.x === from.x &&
      previous.from.y === from.y &&
      previous.to.x === to.x &&
      previous.to.y === to.y
    )
      return previous.mask;

    const mask = BoardRegions.capsule(
      from,
      to,
      HitTestConfig.ERASER_RADIUS / this.zoom,
    );

    this.lastSweep = { from: { ...from }, to: { ...to }, mask };

    return mask;
  }
}

export const BoardHitTest = { ERASER_RADIUS: HitTestConfig.ERASER_RADIUS };
