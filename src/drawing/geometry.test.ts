import { describe, expect, it } from 'vitest'
import { strokeGeometry } from './geometry'
import type { Point } from './types'

const points: Point[] = [
  { x: 0, y: 0, pressure: 0.2, time: 1 },
  { x: 10, y: 20, pressure: 0.5, time: 2 },
  { x: 20, y: 0, pressure: 0.7, time: 3 },
  { x: 30, y: 10, pressure: 0.3, time: 4 },
]

describe('canonical stroke geometry', () => {
  it('turns stationary pressure/time samples into one tap without changing raw points', () => {
    const raw = [points[0]!, { ...points[0]!, pressure: 1, time: 2 }]
    expect(strokeGeometry(raw, 3)).toEqual({ kind: 'dot', x: 0, y: 0, radius: 1.5 })
    expect(raw).toHaveLength(2)
    expect(raw[1]?.pressure).toBe(1)
  })

  it('draws two distinct positions as one line with exact endpoints', () => {
    expect(strokeGeometry(points.slice(0, 2), 3)).toEqual({ kind: 'path', commands: [
      { kind: 'move', x: 0, y: 0 }, { kind: 'line', x: 10, y: 20 },
    ] })
  })

  it('uses midpoint quadratics and retains the final endpoint without reverse tails', () => {
    expect(strokeGeometry(points, 3)).toEqual({ kind: 'path', commands: [
      { kind: 'move', x: 0, y: 0 },
      { kind: 'quadratic', cx: 10, cy: 20, x: 15, y: 10 },
      { kind: 'quadratic', cx: 20, cy: 0, x: 25, y: 5 },
      { kind: 'line', x: 30, y: 10 },
    ] })
  })

  it('produces identical geometry regardless of event batching or stationary pointerup', () => {
    const live: Point[] = []
    live.push(...points.slice(0, 2))
    live.push(...points.slice(2))
    const geometry = strokeGeometry(live, 3)
    const committed = [...points, { ...points.at(-1)!, pressure: 0, time: 5 }]
    expect(strokeGeometry(committed, 3)).toEqual(geometry)
    expect(strokeGeometry([...points], 3)).toEqual(geometry)
  })

  it('keeps a loop returning to its starting position', () => {
    const geometry = strokeGeometry([...points, points[0]!], 3)
    expect(geometry.kind).toBe('path')
    if (geometry.kind === 'path') expect(geometry.commands.at(-1)).toEqual({ kind: 'line', x: 0, y: 0 })
  })
})
