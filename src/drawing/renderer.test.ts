import { describe, expect, it, vi } from 'vitest'
import { PenInput } from './input'
import { CanvasRenderer, type FrameScheduler } from './renderer'
import { INK, type ActiveStroke, type PointerInput, type Scene } from './types'
import { initialViewport } from './viewport'
import { BITMAP_PIXEL_BUDGET } from './coordinates'
import { StrokeHistory } from './history'

function layer() {
  const context = {
    setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), arc: vi.fn(),
    fill: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), stroke: vi.fn(),
    lineWidth: 0, lineCap: '', lineJoin: '', fillStyle: '', strokeStyle: '',
  }
  const canvas = { width: 0, height: 0 }
  return { context, canvas,
    target: { canvas: canvas as HTMLCanvasElement, context: context as unknown as CanvasRenderingContext2D } }
}

function frameClock() {
  let nextId = 0
  const pending = new Map<number, () => void>()
  const frames: FrameScheduler = {
    request: vi.fn((callback) => { pending.set(++nextId, callback); return nextId }),
    cancel: vi.fn((id) => { pending.delete(id) }),
  }
  return { frames, pending, run: () => {
    const callbacks = [...pending.values()]
    pending.clear()
    callbacks.forEach((callback) => callback())
  } }
}

function stroke(): ActiveStroke {
  return { id: 1, pointerId: 1, width: 3, color: INK, points: [
    { x: 5, y: 7, pressure: 0.2, time: 1 },
    { x: 10, y: 15, pressure: 1, time: 2 },
    { x: 20, y: 9, pressure: 0.5, time: 3 },
  ] }
}

function pathCalls(context: ReturnType<typeof layer>['context']) {
  return { moves: context.moveTo.mock.calls, lines: context.lineTo.mock.calls,
    curves: context.quadraticCurveTo.mock.calls, dots: context.arc.mock.calls }
}

function setup(scene: Scene = { strokes: [], active: null }) {
  const completed = layer()
  const live = layer()
  const clock = frameClock()
  const renderer = new CanvasRenderer(completed.target, live.target, scene, initialViewport(), clock.frames)
  renderer.resize(200, 100, 1)
  clock.run()
  vi.clearAllMocks()
  return { renderer, completed, live, clock, scene }
}

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return { pointerId: 1, pointerType: 'pen', isPrimary: true, button: 0, buttons: 1,
    clientX: 30, clientY: 40, pressure: 0.5, timeStamp: 1, ...overrides }
}

describe('layered frame renderer', () => {
  it('coalesces many updates into one clear and one full active path per frame', () => {
    const { renderer, scene, live, completed, clock } = setup()
    scene.active = stroke()
    for (let i = 0; i < 20; i++) renderer.activeChanged()
    expect(clock.pending.size).toBe(1)
    expect(live.context.stroke).not.toHaveBeenCalled()
    clock.run()
    expect(live.context.clearRect).toHaveBeenCalledOnce()
    expect(live.context.stroke).toHaveBeenCalledOnce()
    expect(live.context.moveTo).toHaveBeenCalledWith(5, 7)
    expect(live.context.quadraticCurveTo).toHaveBeenCalledWith(10, 15, 15, 12)
    expect(live.context.lineTo).toHaveBeenCalledWith(20, 9)
    expect(completed.context.clearRect).not.toHaveBeenCalled()
    expect(completed.context.stroke).not.toHaveBeenCalled()
  })

  it('does not redraw completed ink while live points arrive across frames', () => {
    const { renderer, scene, completed, live, clock } = setup({ strokes: [stroke()], active: null })
    scene.active = { ...stroke(), id: 2 }
    for (let i = 0; i < 3; i++) {
      scene.active.points.push({ x: 25 + i, y: 10, pressure: 0.5, time: 4 + i })
      renderer.activeChanged()
      clock.run()
    }
    expect(completed.context.clearRect).not.toHaveBeenCalled()
    expect(completed.context.stroke).not.toHaveBeenCalled()
    expect(live.context.stroke).toHaveBeenCalledTimes(3)
  })

  it.each(['off', 'light', 'strong', 65] as const)('uses identical %s path commands for live, pressure-only up, commit and a later full redraw', (mode) => {
    const { renderer, scene, completed, live, clock } = setup()
    const ink = stroke()
    ink.stabilization = typeof mode === 'number' ? { strength: mode, captureZoom: 2 } : { mode, captureZoom: 2 }
    scene.active = ink
    renderer.activeChanged()
    clock.run()
    const livePath = structuredClone(pathCalls(live.context))
    ink.points.push({ ...ink.points.at(-1)!, pressure: 0, time: 4 })
    scene.active = null
    scene.strokes.push(ink)
    renderer.commit(ink)
    clock.run()
    expect(pathCalls(completed.context)).toEqual(livePath)
    expect(live.context.clearRect).toHaveBeenCalledTimes(2)
    vi.clearAllMocks()
    renderer.setViewport({ zoom: 4, x: 10, y: -5 })
    renderer.resize(201, 100, 1)
    clock.run()
    expect(pathCalls(completed.context)).toEqual(livePath)
  })

  it('retains every rapid tap and the next active stroke before a single RAF', () => {
    const { renderer, scene, completed, live, clock } = setup()
    const history = new StrokeHistory(scene.strokes)
    const input = new PenInput({ scene, bounds: () => ({ left: 0, top: 0 }), viewport: initialViewport, width: () => 3,
      onActiveChange: () => renderer.activeChanged(), onCommit: (ink) => { history.commit(ink); renderer.commit(ink) } })
    for (let i = 0; i < 3; i++) {
      input.down(pointer({ clientX: i * 10 }))
      input.up(pointer({ clientX: i * 10, buttons: 0, pressure: 0, timeStamp: 2 }))
    }
    input.down(pointer({ clientX: 99 }))
    expect(clock.pending.size).toBe(1)
    clock.run()
    expect(scene.strokes).toHaveLength(3)
    expect(completed.context.fill).toHaveBeenCalledTimes(3)
    expect(completed.context.arc.mock.calls.map((call) => call[0])).toEqual([0, 10, 20])
    expect(live.context.arc).toHaveBeenCalledExactlyOnceWith(99, 40, 1.5, 0, Math.PI * 2)
  })

  it('removes a queued commit undone before RAF without painting a ghost stroke', () => {
    const original = stroke()
    const { renderer, scene, completed, live, clock } = setup({ strokes: [original], active: null })
    const history = new StrokeHistory(scene.strokes)
    const added = { ...stroke(), id: 2, points: [{ x: 500, y: 400, pressure: 0.5, time: 1 }] }
    history.commit(added)
    renderer.commit(added)
    history.undo()
    renderer.sceneChanged()
    expect(clock.pending.size).toBe(1)
    clock.run()
    expect(completed.context.clearRect).toHaveBeenCalledOnce()
    expect(completed.context.stroke).toHaveBeenCalledOnce()
    expect(completed.context.arc).not.toHaveBeenCalled()
    expect(completed.context.moveTo).toHaveBeenCalledExactlyOnceWith(5, 7)
    expect(live.context.clearRect).toHaveBeenCalledOnce()
    expect(scene.strokes[0]).toBe(original)
    expect(history.canRedo).toBe(true)
  })

  it('coalesces commit→undo→redo before RAF into one canonical redraw without duplicate ink', () => {
    const { renderer, scene, completed, clock } = setup()
    const history = new StrokeHistory(scene.strokes)
    const ink = stroke()
    history.commit(ink)
    renderer.commit(ink)
    history.undo()
    renderer.sceneChanged()
    history.redo()
    renderer.sceneChanged()
    expect(clock.pending.size).toBe(1)
    clock.run()
    expect(completed.context.stroke).toHaveBeenCalledOnce()
    expect(completed.context.clearRect).toHaveBeenCalledOnce()
    expect(scene.strokes[0]).toBe(ink)
  })

  it('coalesces viewport/resize redraws and avoids drawing queued commits twice', () => {
    const { renderer, scene, completed, clock } = setup()
    const ink = stroke()
    scene.strokes.push(ink)
    renderer.commit(ink)
    renderer.setViewport({ zoom: 2, x: 7, y: -5 })
    renderer.setViewport({ zoom: 4, x: 10, y: -7 })
    renderer.resize(300, 200, 2)
    expect(clock.pending.size).toBe(1)
    clock.run()
    expect(completed.context.stroke).toHaveBeenCalledOnce()
    expect(completed.context.clearRect).toHaveBeenCalledOnce()
    expect(completed.context.setTransform).toHaveBeenLastCalledWith(8, 0, 0, 8, 20, -14)
    expect(completed.context.lineWidth).toBe(3)
    expect(ink.points[0]).toMatchObject({ x: 5, y: 7 })
  })

  it('changes raster for native pinch/DPR using actual rounded ratios; board zoom keeps bitmap size', () => {
    const { renderer, scene, completed, live, clock } = setup({ strokes: [stroke()], active: null })
    renderer.resize(101.25, 80.75, 1.5, 2)
    clock.run()
    expect(completed.canvas).toEqual({ width: 304, height: 242 })
    expect(live.canvas).toEqual(completed.canvas)
    expect(completed.context.setTransform).toHaveBeenLastCalledWith(304 / 101.25, 0, 0, 242 / 80.75, 0, 0)
    renderer.setViewport({ zoom: 4, x: 0, y: 0 })
    clock.run()
    expect(completed.canvas).toEqual({ width: 304, height: 242 })
    expect(scene.strokes[0]?.width).toBe(3)
  })

  it('does nothing for repeated size notifications and cancels scheduled work on disposal', () => {
    const { renderer, clock } = setup()
    expect(renderer.needsResize(200, 100, 1)).toBe(false)
    renderer.resize(200, 100, 1)
    expect(clock.pending.size).toBe(0)
    expect(renderer.needsResize(200, 100, 1, 2)).toBe(true)
    renderer.activeChanged()
    expect(clock.pending.size).toBe(1)
    renderer.dispose()
    expect(clock.pending.size).toBe(0)
    renderer.activeChanged()
    expect(clock.pending.size).toBe(0)
  })

  it('keeps both-layer memory inside the budget after every dimension write during orientation swaps', () => {
    const sizes = [{ width: 0, height: 0 }, { width: 0, height: 0 }]
    const allocations: number[] = []
    const totalPixels = () => sizes.reduce((sum, size) => sum + size.width * size.height, 0)
    const trackedCanvas = (index: number): HTMLCanvasElement => {
      const size = sizes[index]!
      return {
        get width() { return size.width },
        set width(value: number) { size.width = value; allocations.push(totalPixels()) },
        get height() { return size.height },
        set height(value: number) { size.height = value; allocations.push(totalPixels()) },
      } as HTMLCanvasElement
    }
    const completed = { ...layer().target, canvas: trackedCanvas(0) }
    const live = { ...layer().target, canvas: trackedCanvas(1) }
    const clock = frameClock()
    const renderer = new CanvasRenderer(completed, live, { strokes: [], active: null }, initialViewport(), clock.frames)
    for (const [width, height] of [[1024, 8192], [8192, 1024], [1024, 8192]] as const) {
      renderer.resize(width, height, 1)
      clock.run()
      expect(sizes).toEqual([{ width, height }, { width, height }])
    }
    expect(Math.max(...allocations)).toBe(BITMAP_PIXEL_BUDGET)
    expect(allocations.every((pixels) => pixels <= BITMAP_PIXEL_BUDGET)).toBe(true)
  })

  it('clears only the live layer when a stroke is cancelled before or after its first frame', () => {
    const { renderer, scene, live, completed, clock } = setup({ strokes: [stroke()], active: null })
    scene.active = { ...stroke(), id: 2 }
    renderer.activeChanged()
    clock.run()
    scene.active = null
    renderer.activeChanged()
    clock.run()
    expect(live.context.clearRect).toHaveBeenCalledTimes(2)
    expect(live.context.stroke).toHaveBeenCalledOnce()
    expect(completed.context.clearRect).not.toHaveBeenCalled()
    expect(completed.context.stroke).not.toHaveBeenCalled()
    scene.active = stroke()
    renderer.activeChanged()
    scene.active = null
    renderer.activeChanged()
    clock.run()
    expect(live.context.stroke).toHaveBeenCalledOnce()
  })
})
