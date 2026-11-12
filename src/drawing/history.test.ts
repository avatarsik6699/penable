import { describe, expect, it, vi } from 'vitest'
import { StrokeHistory } from './history'
import { PenInput } from './input'
import { INK, type PointerInput, type Scene, type Stroke } from './types'
import { initialViewport } from './viewport'

function stroke(id: number): Stroke {
  return { id, color: INK, width: 0.7, points: [{ x: id, y: 2, pressure: 0.6, time: id }],
    stabilization: { strength: 65, captureZoom: 2 } }
}

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerId: 1, pointerType: 'pen', isPrimary: true, button: 0, buttons: 1,
    clientX: 10, clientY: 20, pressure: 0.5, timeStamp: 1, ...overrides }
}

describe('completed stroke history', () => {
  it('starts empty and leaves the same completed array unchanged for empty operations', () => {
    const history = new StrokeHistory()
    const completed = history.strokes
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
    expect(history.strokes).toBe(completed)
    expect(completed).toEqual([])
  })

  it('undoes in reverse order and redoes in original order using the exact objects and metadata', () => {
    const a = stroke(1)
    const b = stroke(2)
    const c = stroke(3)
    b.stabilization = { mode: 'strong', captureZoom: 4 }
    delete c.stabilization
    const originalPoints = a.points
    const originalProfile = a.stabilization
    for (const ink of [a, b, c]) {
      Object.freeze(ink.points[0])
      Object.freeze(ink.points)
      Object.freeze(ink)
    }
    const completed = [a, b, c]
    const history = new StrokeHistory(completed)
    expect(history.strokes).toBe(completed)
    expect(history.undo()).toBe(true)
    expect(history.undo()).toBe(true)
    expect(history.strokes).toEqual([a])
    expect(history.redo()).toBe(true)
    expect(history.strokes[1]).toBe(b)
    expect(history.redo()).toBe(true)
    expect(history.strokes[2]).toBe(c)
    history.undo()
    history.undo()
    history.undo()
    expect(history.canUndo).toBe(false)
    history.redo()
    expect(history.strokes[0]).toBe(a)
    expect(history.strokes[0]?.points).toBe(originalPoints)
    expect(history.strokes[0]?.stabilization).toBe(originalProfile)
    expect(history.strokes[0]?.width).toBe(0.7)
  })

  it('clears redo only when a new stroke is committed and appends that same object', () => {
    const history = new StrokeHistory()
    const a = stroke(1)
    const b = stroke(2)
    const replacement = stroke(3)
    history.commit(a)
    history.commit(b)
    history.undo()
    expect(history.canRedo).toBe(true)
    history.commit(replacement)
    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBe(false)
    expect(history.strokes).toEqual([a, replacement])
    expect(history.strokes[1]).toBe(replacement)
  })

  it('keeps redo through cancelled input; completion is the single history boundary', () => {
    const scene: Scene = { strokes: [], active: null }
    const history = new StrokeHistory(scene.strokes)
    const original = stroke(1)
    history.commit(original)
    history.undo()
    const input = new PenInput({ scene, bounds: () => ({ left: 0, top: 0 }), viewport: initialViewport,
      width: () => 1.2, stabilization: () => 72, onActiveChange: vi.fn(), onCommit: (ink) => history.commit(ink) })
    input.down(pointer())
    input.move(pointer({ clientX: 20, timeStamp: 2 }))
    input.cancel()
    expect(history.canRedo).toBe(true)
    expect(history.strokes).toEqual([])
    history.redo()
    expect(history.strokes[0]).toBe(original)
    history.undo()
    input.down(pointer({ timeStamp: 3 }))
    const active = scene.active
    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 4 }))
    expect(history.canRedo).toBe(false)
    expect(history.strokes[0]).toBe(active)
    expect(scene.active).toBeNull()
  })
})
