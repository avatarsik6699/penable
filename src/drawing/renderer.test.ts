import { describe, expect, it, vi } from 'vitest'
import { CanvasRenderer } from './renderer'
import { INK, type Scene } from './types'

function setup() {
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
  }
  const canvas = { width: 0, height: 0 }
  const renderer = new CanvasRenderer(canvas as HTMLCanvasElement, context as unknown as CanvasRenderingContext2D)
  return { renderer, context, canvas }
}

describe('incremental canvas renderer', () => {
  it('draws a tap and only the new segment on move without clearing the canvas', () => {
    const { renderer, context } = setup()
    const first = { x: 5, y: 7, pressure: 0.2, time: 1 }
    const second = { x: 10, y: 9, pressure: 1, time: 2 }
    const stroke = { id: 1, width: 3, color: INK, points: [first, second] }
    renderer.draw(stroke, [first], null)
    expect(context.arc).toHaveBeenCalledWith(5, 7, 1.5, 0, Math.PI * 2)
    context.lineTo.mockClear()
    renderer.draw(stroke, [second], first)
    expect(context.arc).toHaveBeenCalledOnce()
    expect(context.moveTo).toHaveBeenLastCalledWith(5, 7)
    expect(context.lineTo.mock.calls).toEqual([[10, 9]])
    expect(context.clearRect).not.toHaveBeenCalled()
  })

  it('redraws completed logical geometry at a new DPR; identical resize does nothing', () => {
    const { renderer, context, canvas } = setup()
    const scene: Scene = { strokes: [{ id: 1, width: 3, color: INK, points: [{ x: 20, y: 30, pressure: 0.5, time: 1 }] }], active: null }
    renderer.resize(200, 100, 1, scene)
    expect(renderer.needsResize(200, 100, 1)).toBe(false)
    renderer.resize(200, 100, 1, scene)
    expect(context.clearRect).toHaveBeenCalledOnce()
    expect(renderer.needsResize(200, 100, 2)).toBe(true)
    renderer.resize(200, 100, 2, scene)
    expect(canvas).toEqual({ width: 400, height: 200 })
    expect(context.setTransform).toHaveBeenLastCalledWith(2, 0, 0, 2, 0, 0)
    expect(context.arc).toHaveBeenLastCalledWith(20, 30, 1.5, 0, Math.PI * 2)
    expect(scene.strokes[0]?.points[0]).toMatchObject({ x: 20, y: 30 })
  })
})
