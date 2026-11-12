import { describe, expect, it } from 'vitest'
import { strokeGeometry } from './geometry'
import { DEFAULT_STABILIZATION_STRENGTH, normalizeStrength, stabilizedPositions } from './stabilization'
import type { Point, Position, StabilizationMode } from './types'

const modes = ['off', 'light', 'strong'] as const

function jitter(): Point[] {
  return Array.from({ length: 241 }, (_, index) => ({
    x: index * 0.5, y: index === 0 ? 0 : index % 2 ? 1 : -1,
    pressure: 0.4 + (index % 3) * 0.1, time: index * 1000 / 120,
  }))
}

function rmsY(points: readonly Position[]): number {
  const interior = points.slice(1, -1)
  return Math.sqrt(interior.reduce((sum, point) => sum + point.y ** 2, 0) / interior.length)
}

describe('derived handwriting stabilization', () => {
  it('defaults the UI to 65 while unprofiled and off strokes retain the previous geometry', () => {
    const points = jitter()
    expect(DEFAULT_STABILIZATION_STRENGTH).toBe(65)
    const originalPath = strokeGeometry(points, 3)
    expect(strokeGeometry(stabilizedPositions(points), 3)).toEqual(originalPath)
    expect(strokeGeometry(stabilizedPositions(points, { mode: 'off', captureZoom: 4 }), 3)).toEqual(originalPath)
  })

  it.each([['off', 0], ['light', 50], ['strong', 100]] as const)('keeps numeric anchor %s/%s exactly compatible with legacy profiles', (mode, strength) => {
    const points = jitter().slice(0, 5)
    const legacy = stabilizedPositions(points, { mode, captureZoom: 1 })
    expect(stabilizedPositions(points, { strength, captureZoom: 1 })).toEqual(legacy)
    const previousPositions = {
      off: [{ x: 0, y: 0 }, { x: 0.5, y: 1 }, { x: 1, y: -1 }, { x: 1.5, y: 1 }, { x: 2, y: -1 }],
      light: [{ x: 0, y: 0 }, { x: 0.19683917148398228, y: 0.39367834296796456 },
        { x: 0.5147631085979418, y: -0.15799660199357013 }, { x: 0.9068495169927864, y: 0.3028415300042799 }, { x: 2, y: -1 }],
      strong: [{ x: 0, y: 0 }, { x: 0.12353365644776998, y: 0.24706731289553996 },
        { x: 0.34202965122572515, y: -0.06381651634752211 }, { x: 0.6332314485678021, y: 0.20370784809798959 }, { x: 2, y: -1 }],
    }
    expect(legacy).toEqual(previousPositions[mode])
  })

  it('blends lower strengths continuously toward light without feeding the blend into filter state', () => {
    const points = jitter()
    const light = stabilizedPositions(points, { strength: 50, captureZoom: 1 })
    const quarter = stabilizedPositions(points, { strength: 25, captureZoom: 1 })
    for (let index = 0; index < points.length; index++) {
      const raw = points[index]!
      expect(quarter[index]).toEqual({ x: raw.x + (light[index]!.x - raw.x) / 2, y: raw.y + (light[index]!.y - raw.y) / 2 })
    }
  })

  it('offers an intermediate attenuation between the old light and strong profiles', () => {
    const points = jitter()
    const light = rmsY(stabilizedPositions(points, { strength: 50, captureZoom: 1 }))
    const middle = rmsY(stabilizedPositions(points, { strength: 65, captureZoom: 1 }))
    const strong = rmsY(stabilizedPositions(points, { strength: 100, captureZoom: 1 }))
    expect(middle).toBeLessThan(light)
    expect(middle).toBeGreaterThan(strong)
  })

  it.each([0, 50, 100])('has no support-point jump at strength boundary %s', (boundary) => {
    const points = jitter()
    const before = stabilizedPositions(points, { strength: boundary - 0.001, captureZoom: 1 })
    const after = stabilizedPositions(points, { strength: boundary + 0.001, captureZoom: 1 })
    const distance = Math.max(...before.map((point, index) => Math.hypot(point.x - after[index]!.x, point.y - after[index]!.y)))
    expect(distance).toBeLessThan(0.001)
  })

  it('normalizes out-of-range/non-finite strength, legacy selection values and preserves numeric raw data', () => {
    expect(normalizeStrength(-20)).toBe(0)
    expect(normalizeStrength(120)).toBe(100)
    expect(normalizeStrength(NaN)).toBe(0)
    expect(normalizeStrength(Infinity)).toBe(0)
    expect(normalizeStrength(62.5)).toBe(62.5)
    expect(['off', 'light', 'strong'].map((mode) => normalizeStrength(mode as StabilizationMode))).toEqual([0, 50, 100])
    const points = jitter()
    const before = structuredClone(points)
    for (const point of points) Object.freeze(point)
    Object.freeze(points)
    expect(stabilizedPositions(points, { strength: NaN, captureZoom: 1 })).toEqual(stabilizedPositions(points))
    stabilizedPositions(points, { strength: 65, captureZoom: 2 })
    expect(points).toEqual(before)
  })

  it.each([[25, 0.75], [65, 1.95], [75, 2.25]] as const)('caps intermediate strength %s at %s captured CSS pixels', (strength, limit) => {
    const points = Array.from({ length: 50 }, (_, index) => ({
      x: index * 12, y: index % 2 ? 20 : -20, pressure: 0.5, time: index,
    }))
    const output = stabilizedPositions(points, { strength, captureZoom: 4 })
    const maximum = Math.max(...output.map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y) * 4))
    expect(maximum).toBeLessThanOrEqual(limit + 1e-9)
    expect(maximum).toBeCloseTo(limit, 8)
  })

  it.each(modes)('keeps canonical raw positions, pressure and timestamps immutable in %s mode', (mode) => {
    const points = jitter()
    const before = structuredClone(points)
    for (const point of points) Object.freeze(point)
    Object.freeze(points)
    stabilizedPositions(points, { mode, captureZoom: 2 })
    expect(points).toEqual(before)
  })

  it('reduces controlled slow-motion jitter more strongly in strong mode', () => {
    const points = jitter()
    const raw = rmsY(points)
    const light = rmsY(stabilizedPositions(points, { mode: 'light', captureZoom: 1 }))
    const strong = rmsY(stabilizedPositions(points, { mode: 'strong', captureZoom: 1 }))
    expect(light).toBeLessThan(raw * 0.4)
    expect(strong).toBeLessThan(light * 0.8)
  })

  it.each([['light', 1.5], ['strong', 3]] as const)('caps %s support-point deviation at %s captured CSS pixels', (mode, limit) => {
    const points = Array.from({ length: 50 }, (_, index) => ({
      x: index * 12, y: index % 2 ? 20 : -20, pressure: 0.5, time: index,
    }))
    const captureZoom = 4
    const output = stabilizedPositions(points, { mode, captureZoom })
    const distances = output.map((point, index) => Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y) * captureZoom)
    expect(Math.max(...distances)).toBeLessThanOrEqual(limit + 1e-9)
    expect(Math.max(...distances)).toBeCloseTo(limit, 8)
    expect(output[0]).toEqual({ x: points[0]!.x, y: points[0]!.y })
    expect(output.at(-1)).toEqual({ x: points.at(-1)!.x, y: points.at(-1)!.y })
  })

  it.each(['light', 'strong'] as const)('is rotation/translation invariant in %s mode', (mode) => {
    const points = jitter()
    const angle = 0.73
    const rotate = (point: Position) => ({
      x: point.x * Math.cos(angle) - point.y * Math.sin(angle) + 75,
      y: point.x * Math.sin(angle) + point.y * Math.cos(angle) - 130,
    })
    const output = stabilizedPositions(points, { mode, captureZoom: 2 })
    const rotated = stabilizedPositions(points.map((point) => ({ ...point, ...rotate(point) })), { mode, captureZoom: 2 })
    for (let index = 0; index < output.length; index++) {
      const expected = rotate(output[index]!)
      expect(rotated[index]!.x).toBeCloseTo(expected.x, 8)
      expect(rotated[index]!.y).toBeCloseTo(expected.y, 8)
    }
  })

  it('applies equal filtering to the same captured CSS motion at different board scales', () => {
    const points = jitter()
    const output = stabilizedPositions(points, { mode: 'light', captureZoom: 1 })
    const scaled = stabilizedPositions(points.map((point) => ({ ...point, x: point.x / 4, y: point.y / 4 })), { mode: 'light', captureZoom: 4 })
    for (let index = 0; index < output.length; index++) {
      expect(scaled[index]!.x * 4).toBeCloseTo(output[index]!.x, 10)
      expect(scaled[index]!.y * 4).toBeCloseTo(output[index]!.y, 10)
    }
  })

  it('uses deterministic finite steps for repeated, decreasing and non-finite timestamps', () => {
    const points = jitter().slice(0, 8)
    const repeated = points.map((point) => ({ ...point, time: 0 }))
    const expected = stabilizedPositions(points, { mode: 'strong', captureZoom: 1 })
    const actual = stabilizedPositions(repeated, { mode: 'strong', captureZoom: 1 })
    for (let index = 0; index < actual.length; index++) {
      expect(actual[index]!.x).toBeCloseTo(expected[index]!.x, 10)
      expect(actual[index]!.y).toBeCloseTo(expected[index]!.y, 10)
    }
    const times = [0, 0, -10, NaN, Infinity, 20, 19, 22]
    const anomalous = points.map((point, index) => ({ ...point, time: times[index]! }))
    const output = stabilizedPositions(anomalous, { mode: 'strong', captureZoom: 1 })
    expect(output.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
    expect(stabilizedPositions(anomalous, { mode: 'strong', captureZoom: 1 })).toEqual(output)
  })

  it.each(modes)('skips duplicate XY before advancing state and keeps pressure-only up geometry identical in %s', (mode) => {
    const points = jitter().slice(0, 12)
    const profile = { mode, captureZoom: 2 }
    const baseline = stabilizedPositions(points, profile)
    const withDuplicates = points.flatMap((point) => [point, { ...point, pressure: 1, time: point.time + 0.5 }])
    withDuplicates.push({ ...points.at(-1)!, pressure: 0, time: 500 })
    expect(stabilizedPositions(withDuplicates, profile)).toEqual(baseline)
    expect(strokeGeometry(stabilizedPositions(withDuplicates, profile), 3)).toEqual(strokeGeometry(baseline, 3))
  })

  it('feeds the capped state forward without feeding the displayed endpoint override into the filter', () => {
    const points = [0, 10, 10.5, 11].map((x, index) => ({ x, y: 0, pressure: 0.5, time: index * 8 }))
    const profile = { mode: 'light' as const, captureZoom: 1 }
    expect(stabilizedPositions(points.slice(0, 2), profile).at(-1)?.x).toBe(10)
    const output = stabilizedPositions(points, profile)
    expect(output[1]?.x).toBeCloseTo(8.5, 8)
    expect(output[2]!.x).toBeGreaterThan(9.1)
    expect(output[2]!.x).toBeLessThan(9.8)
  })

  it.each(modes)('keeps taps, two-point lines and a quick reversal endpoint without adding a tip vertex in %s', (mode: StabilizationMode) => {
    const points = [0, 8, 16, 9, 2].map((x, index) => ({ x, y: 0, pressure: 0.5, time: index * 8 }))
    const profile = { mode, captureZoom: 1 }
    expect(strokeGeometry(stabilizedPositions(points.slice(0, 1), profile), 3)).toEqual({ kind: 'dot', x: 0, y: 0, radius: 1.5 })
    expect(strokeGeometry(stabilizedPositions(points.slice(0, 2), profile), 3)).toEqual({ kind: 'path', commands: [
      { kind: 'move', x: 0, y: 0 }, { kind: 'line', x: 8, y: 0 },
    ] })
    const output = stabilizedPositions(points, profile)
    expect(output).toHaveLength(points.length)
    expect(output.at(-1)).toEqual({ x: 2, y: 0 })
    expect(output.every((point) => point.x >= 0 && point.x <= 16)).toBe(true)
    const geometry = strokeGeometry(output, 3)
    expect(geometry.kind).toBe('path')
    if (geometry.kind === 'path') {
      expect(geometry.commands).toHaveLength(points.length)
      expect(geometry.commands.at(-1)).toEqual({ kind: 'line', x: 2, y: 0 })
    }
  })
})
