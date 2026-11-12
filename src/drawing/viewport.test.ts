import { describe, expect, it, vi } from 'vitest'
import { BoardNavigation, initialViewport, screenToWorld, worldToScreen, zoomAt } from './viewport'
import type { PointerInput } from './types'

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1,
    clientX: 30, clientY: 40, pressure: 0.5, timeStamp: 1, ...overrides }
}

describe('world / CSS viewport', () => {
  it.each([0.25, 1, 2, 4, 8])('round-trips through zoom %s with translated origin', (zoom) => {
    const point = { x: -123.456, y: 987.654 }
    const viewport = { zoom, x: -75.25, y: 203.75 }
    const result = screenToWorld(worldToScreen(point, viewport), viewport)
    expect(result.x).toBeCloseTo(point.x, 6)
    expect(result.y).toBeCloseTo(point.y, 6)
  })

  it('keeps the same world point beneath an arbitrary zoom anchor', () => {
    const viewport = { zoom: 1.2, x: 50, y: -17 }
    const anchor = { x: 328.25, y: 70.75 }
    const world = screenToWorld(anchor, viewport)
    const next = zoomAt(viewport, 4, anchor)
    expect(worldToScreen(world, next).x).toBeCloseTo(anchor.x, 6)
    expect(worldToScreen(world, next).y).toBeCloseTo(anchor.y, 6)
    expect(viewport).toEqual({ zoom: 1.2, x: 50, y: -17 })
  })

  it('clamps zoom while preserving the anchor and ignores invalid requests', () => {
    const anchor = { x: 100, y: 60 }
    const high = zoomAt(initialViewport(), 1000, anchor)
    expect(high.zoom).toBe(8)
    expect(worldToScreen(anchor, high)).toEqual(anchor)
    expect(zoomAt(initialViewport(), 0.01, anchor).zoom).toBe(0.25)
    expect(zoomAt(high, NaN, anchor)).toBe(high)
  })
})

describe('navigation policy', () => {
  it('ignores wheel, buttons, reset and pan during ink without changing the scene viewport', () => {
    const onChange = vi.fn()
    const viewport = { zoom: 2, x: 5, y: 10 }
    const navigation = new BoardNavigation({ viewport, isDrawing: () => true, onChange })
    expect(navigation.wheel(-100, 0, { x: 100, y: 100 }, 800)).toBe(false)
    expect(navigation.setZoom(4, { x: 0, y: 0 })).toBe(false)
    expect(navigation.reset()).toBe(false)
    expect(navigation.startPan(pointer(), true)).toBe(false)
    expect(navigation.startPan(pointer({ button: 1, buttons: 4 }), false)).toBe(false)
    expect(navigation.viewport).toBe(viewport)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('pans in CSS pixels with space-primary or middle, never normal/right/touch contact', () => {
    const navigation = new BoardNavigation({ viewport: { zoom: 4, x: 5, y: 10 }, isDrawing: () => false, onChange: vi.fn() })
    expect(navigation.startPan(pointer(), false)).toBe(false)
    expect(navigation.startPan(pointer({ button: 2, buttons: 2 }), true)).toBe(false)
    expect(navigation.startPan(pointer({ pointerType: 'touch' }), true)).toBe(false)
    expect(navigation.startPan(pointer(), true)).toBe(true)
    expect(navigation.movePan(pointer({ pointerId: 2, clientX: 80 }))).toBe(false)
    navigation.movePan(pointer({ clientX: 80, clientY: 20 }))
    expect(navigation.viewport).toEqual({ zoom: 4, x: 55, y: -10 })
    expect(navigation.endPan(2)).toBe(false)
    expect(navigation.endPan(1)).toBe(true)
    expect(navigation.startPan(pointer({ button: 1, buttons: 4 }), false)).toBe(true)
    navigation.movePan(pointer({ button: -1, buttons: 0 }))
    expect(navigation.pointerId).toBeNull()
  })

  it('resets both scale and pan, and normalizes line/page wheel units', () => {
    const navigation = new BoardNavigation({ viewport: initialViewport(), isDrawing: () => false, onChange: vi.fn() })
    navigation.wheel(-10, 1, { x: 100, y: 100 }, 800)
    expect(navigation.viewport.zoom).toBeCloseTo(Math.exp(0.32), 6)
    navigation.wheel(-1, 2, { x: 100, y: 100 }, 800)
    expect(navigation.viewport.zoom).toBeGreaterThan(1)
    navigation.reset()
    expect(navigation.viewport).toEqual(initialViewport())
  })
})
