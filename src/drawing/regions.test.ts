import { describe, expect, it } from 'vitest'
import { groupedStrokes, rectangle, selectParts, visibleBounds, contains, lasso } from './regions'
import { INK, type Stroke } from './types'
import { StrokeHitTester } from './hit-test'
import { StrokeHistory } from './history'
const stroke = (): Stroke => ({ id: 1, width: 12, color: INK, points: [{ x: 0, y: 0, pressure: 1, time: 0 }, { x: 100, y: 0, pressure: 1, time: 1 }] })
describe('painted fragment selection', () => {
  it('selects a thick edge whose centerline is outside and preserves the complete raw source', () => {
    const original = stroke()
    const [part] = selectParts([original], rectangle({ x: 20, y: 4 }, { x: 40, y: 8 }), () => 2)
    expect(part).toBeDefined()
    expect(part!.selected.points).toBe(original.points)
    expect(part!.selected.source).toBe(part!.remainder!.source)
    expect(visibleBounds([part!.selected])).toMatchObject({ left: 20, right: 40, top: 4, bottom: 6 })
    const tester = new StrokeHitTester(8)
    expect(tester.hits(part!.selected, { x: 30, y: 5 }, { x: 30, y: 5 })).toBe(true)
    expect(tester.hits(part!.selected, { x: 90, y: 0 }, { x: 90, y: 0 })).toBe(false)
  })
  it('unions complementary sibling clips once after moving back', () => {
    const [part] = selectParts([stroke()], rectangle({ x: 20, y: -10 }, { x: 40, y: 10 }), () => 2)
    const combined = groupedStrokes([part!.selected, part!.remainder!])
    expect(combined).toHaveLength(1)
    expect(visibleBounds(combined)).toEqual(visibleBounds([stroke()]))
    expect(groupedStrokes([part!.selected, { ...part!.remainder!, translation: { x: .25, y: 0 } }])).toHaveLength(2)
  })
  it('supports holes and nonzero self-crossing lasso', () => {
    const mask = lasso([{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }, { x: 20, y: 0 }])
    expect(contains(mask, { x: 10, y: 2 })).toBe(true)
    expect(contains(mask, { x: -1, y: 5 })).toBe(false)
    const hole = [[[[0,0],[20,0],[20,20],[0,20],[0,0]], [[5,5],[5,15],[15,15],[15,5],[5,5]]]] as import('./types').ClipMask
    expect(contains(hole, { x: 10, y: 10 })).toBe(false)
  })
  it('replaces atomically, restores exact objects and order and keeps redo for no-op', () => {
    const a = stroke(), b = { ...stroke(), id: 2 }, c = { ...stroke(), id: 3 }
    const scene = [a,b,c], history = new StrokeHistory(scene, scene.length)
    const moved = { ...b, translation: { x: 5, y: 0 } }
    history.replace([a,moved,c]); history.undo()
    expect(scene[1]).toBe(b)
    expect(history.replace([a,b,c])).toBe(false)
    expect(history.canRedo).toBe(true)
    history.redo(); expect(scene[1]).toBe(moved)
  })
})

describe('exact footprint regressions', () => {
  it('keeps a painted dot sliver between vertices of an inscribed 32-gon', () => {
    const dot = { ...stroke(), width: 2, points: [{ x: 0, y: 0, pressure: 1, time: 0 }] }
    const x = .999 * Math.cos(Math.PI / 32), y = .999 * Math.sin(Math.PI / 32)
    expect(selectParts([dot], rectangle({ x: x - .0001, y: y - .0001 }, { x: x + .0001, y: y + .0001 }), () => 2)).toHaveLength(1)
  })
  it('retains circular arcs outside a lasso shaped as an inscribed polygon', () => {
    const dot = { ...stroke(), width: 2, points: [{ x: 0, y: 0, pressure: 1, time: 0 }] }
    const points = Array.from({ length: 32 }, (_, i) => ({ x: Math.cos(i * Math.PI / 16), y: Math.sin(i * Math.PI / 16) }))
    const [part] = selectParts([dot], lasso(points), () => 2)
    expect(part!.remainder).not.toBeNull()
    expect(part!.remainder!.points).toBe(dot.points)
  })
  it('selects and bounds a normal 50-point curve without unioning its painted capsules', () => {
    const normal = { ...stroke(), width: 2, points: Array.from({ length: 50 }, (_, i) => ({ x: i * 2, y: Math.sin(i / 10) * 15, time: i, pressure: .5 })) }
    const [part] = selectParts([normal], rectangle({ x: 10, y: -30 }, { x: 50, y: 30 }), () => 2)
    expect(part).toBeDefined()
    const bounds = visibleBounds([part!.selected])!
    expect(bounds.left).toBe(10); expect(bounds.right).toBe(50)
    expect(part!.remainder).not.toBeNull()
  })
  it('rejects a distant 10000-point stroke using its bounds', () => {
    const distant = { ...stroke(), width: 2, points: Array.from({ length: 10_000 }, (_, i) => ({ x: 10000 + i, y: Math.sin(i), time: i, pressure: .5 })) }
    const before = performance.now()
    expect(selectParts([distant], rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }), () => 2)).toEqual([])
    // Generous bound catches the previous >1s painted-union regression without timing noise.
    expect(performance.now() - before).toBeLessThan(500)
  })
  it('applies reused-reference reordering and restores order and identity on undo/redo', () => {
    const a = stroke(), b = { ...stroke(), id: 2 }, scene = [a, b]
    const history = new StrokeHistory(scene, 2)
    history.replace([b, a]); expect(scene).toEqual([b, a]); expect(scene[0]).toBe(b)
    history.undo(); expect(scene).toEqual([a, b]); expect(scene[0]).toBe(a)
    history.redo(); expect(scene[0]).toBe(b)
  })
})
