import { strokeGeometry, type StrokeGeometry } from './geometry'
import { stabilizedPositions } from './stabilization'
import type { Stroke } from './types'

const strokeCache = new WeakMap<Stroke, StrokeGeometry>()
const geometryCache = new WeakMap<Stroke['points'], Map<string, StrokeGeometry>>()
export function sourceGeometry(stroke: Stroke, active = false): StrokeGeometry {
  if (active) return strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width)
  const known = strokeCache.get(stroke)
  if (known) return known
  const key = JSON.stringify([stroke.width, stroke.stabilization])
  let cache = geometryCache.get(stroke.points)
  if (!cache) { cache = new Map(); geometryCache.set(stroke.points, cache) }
  let geometry = cache.get(key)
  if (!geometry) { geometry = strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width); cache.set(key, geometry) }
  strokeCache.set(stroke, geometry)
  return geometry
}
