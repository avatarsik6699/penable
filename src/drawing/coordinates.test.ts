import { describe, expect, it } from 'vitest'
import { bitmapSize, toScenePoint, validDpr } from './coordinates'

describe('scene coordinates', () => {
  const sample = { pointerId: 1, clientX: 42.5, clientY: 120.25, pressure: 0, timeStamp: 12 }

  it('subtracts the CSS origin without rounding or bitmap scaling', () => {
    expect(toScenePoint(sample, { left: 10.25, top: 20.5 })).toEqual({
      x: 32.25, y: 99.75, pressure: 0, time: 12,
    })
  })

  it('retains positions outside the sheet for pointer capture', () => {
    expect(toScenePoint(sample, { left: 50, top: 140 })).toMatchObject({ x: -7.5, y: -19.75 })
  })

  it('DPR changes only bitmap resolution, never the stored scene point', () => {
    const point = toScenePoint(sample, { left: 0, top: 0 })
    expect(bitmapSize(300, 200, 1)).toEqual({ width: 300, height: 200 })
    expect(bitmapSize(300, 200, 2)).toEqual({ width: 600, height: 400 })
    expect(point).toEqual(toScenePoint(sample, { left: 0, top: 0 }))
    expect(point?.x).toBe(42.5)
  })

  it.each([NaN, Infinity, -1, 0])('uses a safe DPR for %s', (value) => {
    expect(validDpr(value)).toBe(1)
  })

  it('rejects non-finite input values and bounds', () => {
    expect(toScenePoint({ ...sample, pressure: NaN }, { left: 0, top: 0 })).toBeNull()
    expect(toScenePoint(sample, { left: Infinity, top: 0 })).toBeNull()
  })
})
