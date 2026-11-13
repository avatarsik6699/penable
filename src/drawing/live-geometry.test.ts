import { afterEach, describe, expect, it, vi } from 'vitest'
import { strokeGeometry, type PathCommand } from './geometry'
import { paintStroke } from './paint'
import { sourceGeometry } from './source-geometry'
import { stabilizedPositions } from './stabilization'
import { INK, type Point, type StabilizationProfile, type Stroke } from './types'

function ink(stabilization?: StabilizationProfile): Stroke {
  return { id: 1, color: INK, width: 3, points: [], stabilization }
}
function motion(count: number): Point[] {
  return Array.from({ length: count }, (_, index) => ({
    x: Math.sin(index * 0.37) * (index % 7 === 0 ? 40 : 2) + index * 0.04,
    y: Math.cos(index * 0.23) * 3, pressure: (index % 10) / 10,
    time: index % 11 === 0 ? 0 : index * 1000 / 120,
  }))
}
function reference(stroke: Stroke) {
  return strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width)
}

class RecordingPath {
  static writes = 0
  commands: PathCommand[]
  constructor(source?: RecordingPath) { this.commands = source ? [...source.commands] : [] }
  moveTo(x: number, y: number) { RecordingPath.writes++; this.commands.push({ kind: 'move', x, y }) }
  lineTo(x: number, y: number) { RecordingPath.writes++; this.commands.push({ kind: 'line', x, y }) }
  quadraticCurveTo(cx: number, cy: number, x: number, y: number) {
    RecordingPath.writes++; this.commands.push({ kind: 'quadratic', cx, cy, x, y })
  }
}
function context() {
  return { stroke: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn() } as unknown as CanvasRenderingContext2D
}

afterEach(() => vi.unstubAllGlobals())

describe('append-only handwriting geometry', () => {
  const profiles: (StabilizationProfile | undefined)[] = [undefined,
    ...['off', 'light', 'strong'].map(mode => ({ mode, captureZoom: 2 }) as StabilizationProfile),
    ...[0, 0.01, 25, 49.999, 50, 50.001, 65, 99.99, 100, NaN, Infinity, -10, 110].flatMap(strength =>
      [0.25, 1, 1.7, 8].map(captureZoom => ({ strength, captureZoom }))),
  ]
  it.each(profiles)('matches the independent batch curve at every prefix (%j)', (profile) => {
    const stroke = ink(profile)
    const points = motion(120)
    for (let index = 0; index < points.length; index++) {
      const point = points[index]!
      stroke.points.push(point)
      if (index % 7 === 0) stroke.points.push({ ...point, pressure: 1, time: point.time + 1 })
      expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
      expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    }
    stroke.points.push({ ...stroke.points.at(-1)!, pressure: 0, time: 2000 })
    expect(sourceGeometry(stroke)).toEqual(reference(stroke))
    const completed = structuredClone(sourceGeometry(stroke))
    // A new active builder must not mutate an already cached completed curve.
    sourceGeometry(stroke, true)
    stroke.points.push({ x: 99, y: 21, pressure: 1, time: 2001 })
    sourceGeometry(stroke, true)
    expect(sourceGeometry(stroke)).toEqual(completed)
  })

  it('handles exact reversals, stabilized duplicate positions, pressure-only release and anomalous timestamps', () => {
    const stroke = ink({ strength: 65, captureZoom: 4 })
    const times = [0, 0, -10, NaN, Infinity, 20, 19, 22]
    for (let index = 0; index < times.length; index++) {
      const point = { x: [0, 0, 5, 0, 0, -5, 0, 0][index]!, y: 0, pressure: 0.5, time: times[index]! }
      stroke.points.push(point)
      expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    }
    expect(sourceGeometry(stroke)).toEqual(reference(stroke))
    const off = ink()
    for (const x of [0, 1, 0, 0, 1, 1, 0]) {
      off.points.push({ x, y: 0, pressure: 1, time: 1 })
      expect(sourceGeometry(off, true)).toEqual(reference(off))
    }
  })

  it('deduplicates filtered coordinates lost to precision near the coordinate limit', () => {
    const stroke = ink({ strength: 100, captureZoom: 0.25 })
    for (let index = 0; index < 50; index++) {
      stroke.points.push({ x: 1e9 + Math.sin(index) * 2e-7, y: -1e9 + Math.cos(index) * 2e-7,
        pressure: 0.5, time: index * 0.001 })
      expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    }
  })

  it('resets on replaced point array, profile, width and truncated input', () => {
    const stroke = ink({ strength: 65, captureZoom: 1 })
    stroke.points.push(...motion(30))
    sourceGeometry(stroke, true)
    stroke.points = motion(20)
    expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    stroke.stabilization = { mode: 'strong', captureZoom: 8 }
    expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    stroke.width = 0.5
    expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    stroke.points.length = 2
    expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    stroke.points.length = 0
    expect(sourceGeometry(stroke, true)).toEqual({ kind: 'empty' })
    stroke.points.push(...motion(5))
    expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
  })

  it('handles coalesced batches and leaves all canonical samples unchanged', () => {
    const stroke = ink({ strength: 65, captureZoom: 1 })
    const raw = motion(130)
    raw.forEach(Object.freeze)
    for (let index = 0; index < raw.length; index += 13) {
      stroke.points.push(...raw.slice(index, index + 13))
      expect(sourceGeometry(stroke, true)).toEqual(reference(stroke))
    }
    expect(stroke.points).toEqual(raw)
  })

  it('reads new raw samples once instead of replaying the full prefix on each frame', () => {
    const stroke = ink({ strength: 65, captureZoom: 1 })
    const raw: Point[] = []
    let reads = 0
    stroke.points = new Proxy(raw, { get(target, property, receiver) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads++
      return Reflect.get(target, property, receiver)
    } })
    for (const point of motion(2000)) {
      raw.push(point)
      sourceGeometry(stroke, true)
      sourceGeometry(stroke, true)
    }
    expect(reads).toBe(2000)
    expect(sourceGeometry(stroke)).toEqual(reference(stroke))
  })

  it('appends the native prefix once and draws one equivalent combined path per frame', () => {
    vi.stubGlobal('Path2D', RecordingPath)
    RecordingPath.writes = 0
    const stroke = ink({ strength: 65, captureZoom: 2 })
    const ctx = context()
    for (const point of motion(300)) {
      stroke.points.push(point)
      paintStroke(ctx, stroke, true)
      const expected = reference(stroke)
      if (expected.kind === 'path') {
        const path = vi.mocked(ctx.stroke).mock.lastCall?.[0] as unknown as RecordingPath
        expect(path.commands).toEqual(expected.commands)
      }
    }
    expect(ctx.stroke).toHaveBeenCalledTimes(299)
    expect(ctx.fill).toHaveBeenCalledOnce()
    expect(RecordingPath.writes).toBeLessThan(300 * 4)
  })

  it('supports a returning raw tip equal to the last stable position without changing the native prefix', () => {
    vi.stubGlobal('Path2D', RecordingPath)
    const stroke = ink()
    const ctx = context()
    for (const x of [0, 10, 0, 10, 0, 0, 20, 0]) {
      stroke.points.push({ x, y: 0, pressure: 1, time: 1 })
      paintStroke(ctx, stroke, true)
      const expected = reference(stroke)
      if (expected.kind === 'path') {
        const path = vi.mocked(ctx.stroke).mock.lastCall?.[0] as unknown as RecordingPath
        expect(path.commands).toEqual(expected.commands)
      }
    }
  })
})
