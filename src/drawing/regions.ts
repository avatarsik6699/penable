import { difference, intersection, union, type MultiPolygon, type Pair } from 'polygon-clipping'
import { strokeGeometry } from './geometry'
import { stabilizedPositions } from './stabilization'
import type { ClipMask, Position, Stroke } from './types'

export const REGION_LIMITS = { lasso: 2048, mask: 8192, document: 100_000 }
export interface InkBounds { left: number; top: number; right: number; bottom: number }
const lineages = new WeakMap<Stroke, string>()
let sequence = 0
const namespace = Math.random().toString(36).slice(2)
export function newSource(): string { return `source-${namespace}-${++sequence}` }
export function sourceOf(stroke: Stroke): string {
  if (stroke.source) return stroke.source
  let source = lineages.get(stroke)
  if (!source) { source = newSource(); lineages.set(stroke, source) }
  return source
}
export function cloneMask(mask: ClipMask): ClipMask { return mask.map(p => p.map(r => r.map(([x, y]) => [x, y]))) }
export function vertexCount(mask: ClipMask): number { return mask.reduce((n, p) => n + p.reduce((m, r) => m + r.length, 0), 0) }
export function normalizeMask(mask: ClipMask): ClipMask {
  const normalized = union(mask)
  if (vertexCount(normalized) > REGION_LIMITS.mask) throw new Error('Слишком сложная граница: предел 8192 вершин на фрагмент.')
  return normalized
}
export function rectangle(a: Position, b: Position): ClipMask {
  if (a.x === b.x || a.y === b.y) return []
  const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x), top = Math.min(a.y, b.y), bottom = Math.max(a.y, b.y)
  return [[[[left, top], [right, top], [right, bottom], [left, bottom], [left, top]]]]
}
export function lasso(points: readonly Position[]): ClipMask {
  if (points.length > REGION_LIMITS.lasso) throw new Error('Лассо: предел 2048 вершин. Попробуйте более короткую границу.')
  if (points.length < 3) return []
  return normalizeMask([[points.map(p => [p.x, p.y])]])
}
export function translateMask(mask: ClipMask, offset: Position): ClipMask {
  return mask.map(p => p.map(r => r.map(([x, y]) => [x + offset.x, y + offset.y])))
}
export function maskBounds(mask: ClipMask): InkBounds | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const polygon of mask) for (const ring of polygon) for (const [x, y] of ring) {
    left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y)
  }
  return left === Infinity ? null : { left, top, right, bottom }
}
function circle(center: Position, radius: number): MultiPolygon {
  const count = 64, outerRadius = radius / Math.cos(Math.PI / count)
  const ring: Pair[] = []
  // Tangent polygon, never inscribed: analytic hit tests below decide membership.
  for (let i = 0; i < count; i++) { const angle = (i + .5) * Math.PI * 2 / count; ring.push([center.x + outerRadius * Math.cos(angle), center.y + outerRadius * Math.sin(angle)]) }
  ring.push([...ring[0]!])
  return [[ring]]
}
function cross(a: Pair, b: Pair, c: Pair) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) }
export function capsule(from: Position, to: Position, radius: number): MultiPolygon {
  const points = [...circle(from, radius)[0]![0]!.slice(0, -1), ...circle(to, radius)[0]![0]!.slice(0, -1)].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const lower: Pair[] = [], upper: Pair[] = []
  for (const p of points) { while (lower.length > 1 && cross(lower.at(-2)!, lower.at(-1)!, p) <= 0) lower.pop(); lower.push(p) }
  for (const p of points.reverse()) { while (upper.length > 1 && cross(upper.at(-2)!, upper.at(-1)!, p) <= 0) upper.pop(); upper.push(p) }
  const ring = [...lower.slice(0, -1), ...upper.slice(0, -1)]; ring.push([...ring[0]!]); return [[ring]]
}
export function pointSegmentDistance(point: Position, a: Position, b: Position): number {
  const dx = b.x - a.x, dy = b.y - a.y, squared = dx * dx + dy * dy
  const t = squared ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / squared)) : 0
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}
function segmentDistance(a: Position, b: Position, c: Position, d: Position): number {
  const side = (p: Position, q: Position, r: Position) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return 0
  return Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d), pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b))
}
interface InkSegment { a: Position; b: Position; error: number }
const segments = new WeakMap<Stroke['points'], Map<string, InkSegment[]>>()
const clippedBoundsCache = new WeakMap<ClipMask, WeakMap<Stroke['points'], InkBounds | null>>()
const roughBoundsCache = new WeakMap<Stroke, InkBounds | null>()
export function sourceBounds(stroke: Stroke): InkBounds | null {
  if (roughBoundsCache.has(stroke)) return roughBoundsCache.get(stroke)!
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const point of stroke.points) { left = Math.min(left, point.x); right = Math.max(right, point.x); top = Math.min(top, point.y); bottom = Math.max(bottom, point.y) }
  const padding = stroke.width / 2 + (stroke.stabilization ? 3 / stroke.stabilization.captureZoom : 0)
  const result = left === Infinity ? null : { left: left - padding, top: top - padding, right: right + padding, bottom: bottom + padding }
  roughBoundsCache.set(stroke, result); return result
}
function overlaps(a: InkBounds, b: InkBounds): boolean { return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top }
function curveSegments(start: Position, control: Position, end: Position, result: InkSegment[], depth = 0): void {
  const error = Math.hypot(start.x - 2 * control.x + end.x, start.y - 2 * control.y + end.y) / 4
  if (error <= .0001 || depth >= 24) { result.push({ a: start, b: end, error }); return }
  const a = { x: (start.x + control.x) / 2, y: (start.y + control.y) / 2 }, b = { x: (end.x + control.x) / 2, y: (end.y + control.y) / 2 }
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  curveSegments(start, a, mid, result, depth + 1); curveSegments(mid, b, end, result, depth + 1)
}
function sourceSegments(stroke: Stroke): InkSegment[] {
  const key = JSON.stringify([stroke.width, stroke.stabilization])
  const cache = segments.get(stroke.points) ?? new Map<string, InkSegment[]>()
  const cached = cache.get(key)
  if (cached) return cached
  const geometry = strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width), result: InkSegment[] = []
  if (geometry.kind === 'dot') result.push({ a: geometry, b: geometry, error: 0 })
  if (geometry.kind === 'path') {
    let previous: Position | null = null
    for (const command of geometry.commands) {
      if (previous && command.kind === 'quadratic') curveSegments(previous, { x: command.cx, y: command.cy }, command, result)
      else if (previous && command.kind === 'line') result.push({ a: previous, b: command, error: 0 })
      previous = command
    }
  }
  cache.set(key, result); segments.set(stroke.points, cache); return result
}
function segmentBounds(segment: InkSegment, radius: number): InkBounds {
  const r = radius + segment.error
  return { left: Math.min(segment.a.x, segment.b.x) - r, right: Math.max(segment.a.x, segment.b.x) + r, top: Math.min(segment.a.y, segment.b.y) - r, bottom: Math.max(segment.a.y, segment.b.y) + r }
}
export function inkIntersectsMask(stroke: Stroke, mask: ClipMask): boolean {
  const bounds = maskBounds(mask), source = sourceBounds(stroke)
  if (!bounds || !source || !overlaps(bounds, source)) return false
  for (const segment of sourceSegments(stroke)) {
    if (!overlaps(bounds, segmentBounds(segment, stroke.width / 2))) continue
    if (contains(mask, segment.a) || contains(mask, segment.b)) return true
    for (const polygon of mask) for (const ring of polygon) for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1]!, b = ring[i]!
      if (segmentDistance(segment.a, segment.b, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }) <= stroke.width / 2 + segment.error) return true
    }
  }
  return false
}
// Bounds use conservative tangent capsules independently, with no Boolean union of
// painted ink. The renderer always paints the original exact accepted curve.
function localVisibleBounds(stroke: Stroke): InkBounds | null {
  const cache = stroke.clip ? clippedBoundsCache.get(stroke.clip) ?? new WeakMap<Stroke['points'], InkBounds | null>() : null
  if (cache?.has(stroke.points)) return cache.get(stroke.points)!
  const clipBounds = stroke.clip ? maskBounds(stroke.clip) : null
  let result: InkBounds | null = null
  for (const segment of sourceSegments(stroke)) {
    let bounds = segmentBounds(segment, stroke.width / 2)
    if (stroke.clip) {
      if (!clipBounds || !overlaps(bounds, clipBounds)) continue
      bounds = maskBounds(intersection(capsule(segment.a, segment.b, stroke.width / 2 + segment.error), stroke.clip))!
      if (!bounds) continue
    }
    result = mergeBounds(result, bounds)
  }
  if (stroke.clip && cache) { cache.set(stroke.points, result); clippedBoundsCache.set(stroke.clip, cache) }
  return result
}
function mergeBounds(a: InkBounds | null, b: InkBounds): InkBounds { return a ? { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) } : b }
export function visibleBounds(strokes: readonly Stroke[]): InkBounds | null {
  let result: InkBounds | null = null
  for (const stroke of strokes) {
    const bounds = localVisibleBounds(stroke), offset = stroke.translation ?? { x: 0, y: 0 }
    if (bounds) result = mergeBounds(result, { left: bounds.left + offset.x, right: bounds.right + offset.x, top: bounds.top + offset.y, bottom: bounds.bottom + offset.y })
  }
  return result
}
export function contains(mask: ClipMask, point: Position): boolean {
  // Nonzero winding includes holes and the same semantics as Canvas clip/fill.
  let winding = 0
  for (const polygon of mask) for (const ring of polygon) for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!, b = ring[i + 1]!
    const cross = (b[0] - a[0]) * (point.y - a[1]) - (point.x - a[0]) * (b[1] - a[1])
    if (a[1] <= point.y && b[1] > point.y && cross > 0) winding++
    if (a[1] > point.y && b[1] <= point.y && cross < 0) winding--
  }
  return winding !== 0
}
export interface SelectedPart { original: Stroke; selected: Stroke; remainder: Stroke | null }
export function selectParts(strokes: readonly Stroke[], region: ClipMask, allocate: () => number): SelectedPart[] {
  const result: SelectedPart[] = []
  for (const stroke of strokes) {
    const offset = stroke.translation ?? { x: 0, y: 0 }
    const localRegion = translateMask(region, { x: -offset.x, y: -offset.y })
    const source = sourceBounds(stroke), regionBounds = maskBounds(localRegion)
    if (!source || !regionBounds || !overlaps(source, regionBounds)) continue
    const selectedRegion = stroke.clip ? intersection(stroke.clip, localRegion) : localRegion
    if (!inkIntersectsMask(stroke, selectedRegion)) continue
    // An enclosing box keeps the original exact painted boundary; polygonized ink is
    // never substituted for the source curve or used as the rendered clipping edge.
    const bounds = source
    const outer = stroke.clip ?? rectangle({ x: bounds.left - 1, y: bounds.top - 1 }, { x: bounds.right + 1, y: bounds.bottom + 1 })
    const selectedClip = normalizeMask(intersection(outer, localRegion))
    const remainderClip = normalizeMask(difference(outer, localRegion))
    const common = { ...stroke, source: sourceOf(stroke), translation: { ...offset } }
    const selected = { ...common, clip: selectedClip }
    const remainingInk = inkIntersectsMask(stroke, remainderClip)
    result.push({ original: stroke, selected,
      remainder: remainingInk ? { ...common, id: allocate(), clip: remainderClip } : null })
  }
  return result
}
export function traceMask(ctx: CanvasRenderingContext2D, mask: ClipMask): void {
  ctx.beginPath()
  for (const polygon of mask) for (const ring of polygon) {
    if (!ring.length) continue
    ctx.moveTo(...ring[0]!)
    for (let i = 1; i < ring.length; i++) ctx.lineTo(...ring[i]!)
    ctx.closePath()
  }
}
export function groupedStrokes(strokes: readonly Stroke[]): Stroke[] {
  const result: Stroke[] = [], groups = new Map<string, number>()
  for (const stroke of strokes) {
    if (!stroke.source) { result.push(stroke); continue }
    const offset = stroke.translation ?? { x: 0, y: 0 }
    const key = `${stroke.source}:${offset.x}:${offset.y}`
    const index = groups.get(key)
    if (index === undefined) { groups.set(key, result.length); result.push(stroke); continue }
    const previous = result[index]!
    result[index] = { ...previous, clip: !previous.clip || !stroke.clip ? undefined : union(previous.clip, stroke.clip) }
  }
  return result
}
