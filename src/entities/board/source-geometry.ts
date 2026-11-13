import { type StrokeGeometry, BoardGeometry } from "./geometry";
import { BoardStabilization } from "./stabilization";
import { LiveStrokeGeometry } from "./live-geometry";
import type { Stroke } from "./types";

const strokeCache = new WeakMap<Stroke, StrokeGeometry>();

const geometryCache = new WeakMap<
  Stroke["points"],
  Map<string, StrokeGeometry>
>();

const liveCache = new WeakMap<Stroke, LiveStrokeGeometry>();

function geometryKey(stroke: Stroke) {
  return JSON.stringify([stroke.width, stroke.stabilization]);
}

// Active inputs append immutable samples. Replacing the array/profile or shrinking
// it starts a fresh builder; completed geometry never shares a mutable live builder.
function liveGeometry(stroke: Stroke): LiveStrokeGeometry {
  const key = geometryKey(stroke);
  let live = liveCache.get(stroke);

  if (!live?.matches(stroke, key)) {
    live = new LiveStrokeGeometry(stroke, key);
    liveCache.set(stroke, live);
  }

  live.update();

  return live;
}

function sourceGeometry(stroke: Stroke, active = false): StrokeGeometry {
  if (active) return liveGeometry(stroke).update();

  const known = strokeCache.get(stroke);

  if (known) return known;

  const key = geometryKey(stroke);
  let cache = geometryCache.get(stroke.points);

  if (!cache) {
    cache = new Map();
    geometryCache.set(stroke.points, cache);
  }

  let geometry = cache.get(key);

  if (!geometry) {
    const live = liveCache.get(stroke);

    geometry = live?.matches(stroke, key)
      ? live.update()
      : BoardGeometry.strokeGeometry(
          BoardStabilization.stabilizedPositions(
            stroke.points,
            stroke.stabilization,
          ),
          stroke.width,
        );

    cache.set(key, geometry);
  }

  liveCache.delete(stroke);
  strokeCache.set(stroke, geometry);

  return geometry;
}

export const BoardSourceGeometry = { liveGeometry, sourceGeometry };
