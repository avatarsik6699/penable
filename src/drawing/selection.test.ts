import { describe, expect, it } from 'vitest'
import { BoardSelection } from './selection'
import { StrokeHistory } from './history'
import { decodeDocument, emptyDocument } from '../document/codec'
import { INK, type PointerInput, type Scene, type Stroke, type Viewport } from './types'
import { visibleBounds } from './regions'
const ink = (id = 1): Stroke => ({ id, width: 4, color: INK, points: [{ x: 0, y: 50, pressure: .5, time: 0 }, { x: 100, y: 50, pressure: .5, time: 1 }] })
const pointer = (x: number, y: number, overrides: Partial<PointerInput> = {}): PointerInput => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'pen', button: 0, buttons: 1, isPrimary: true, pressure: .5, timeStamp: 0, ...overrides })
function harness(strokes = [ink()], writable = true) {
  const scene: Scene = { strokes, active: null }, history = new StrokeHistory(strokes, strokes.length)
  let viewport: Viewport = { x: 0, y: 0, zoom: 1 }, preview: Stroke[] | null = null, commits = 0, fail = false
  const selection = new BoardSelection({ scene, viewport: () => viewport, bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }), writable: () => writable,
    clipboard: { strokes: [] }, validate: strokes => { if (fail) throw new Error('limit'); decodeDocument({ ...emptyDocument(), strokes }) },
    commit: strokes => { history.replace(strokes); commits++ }, preview: strokes => { preview = strokes }, changed: () => {}, setViewport: value => { viewport = value } })
  const select = () => { selection.down(pointer(20, 40)); selection.move(pointer(40, 60)); selection.up(pointer(40, 60, { buttons: 0 })) }
  return { scene, history, selection, select, preview: () => preview, commits: () => commits, viewport: () => viewport, fail: () => { fail = true } }
}
describe('selection transactions and ownership', () => {
  it('selects and copies without changing scene/history, ignores foreign pointers, keeps redo on zero drag', () => {
    const h = harness(), original = h.scene.strokes[0]
    h.select(); h.selection.copy()
    expect(h.commits()).toBe(0); expect(h.scene.strokes[0]).toBe(original)
    expect(h.selection.hasClipboard).toBe(true)
    h.selection.down(pointer(30, 50)); expect(h.selection.move(pointer(50, 50, { pointerId: 2 }))).toBe(false)
    h.selection.up(pointer(30, 50, { buttons: 0 })); expect(h.commits()).toBe(0)
  })
  it('previews partial move, commits one replacement and undo restores original objects', () => {
    const h = harness(), original = h.scene.strokes[0]
    h.select(); h.selection.down(pointer(30, 50)); h.selection.move(pointer(70, 70))
    expect(h.scene.strokes).toHaveLength(1); expect(h.preview()).toHaveLength(2)
    h.selection.up(pointer(70, 70, { buttons: 0 }))
    expect(h.commits()).toBe(1); expect(h.scene.strokes).toHaveLength(2)
    expect(h.selection.selected[0]!.points).toBe(original!.points)
    h.history.undo(); expect(h.scene.strokes).toEqual([original]); expect(h.scene.strokes[0]).toBe(original)
  })
  it('cancel restores viewport and transient scene after edge-pan, no-op keeps redo', () => {
    const h = harness(); h.select(); h.selection.down(pointer(30, 50)); h.selection.move(pointer(799, 50))
    expect(h.selection.edgePan({ x: 799, y: 50 }, 1)).toBe(true)
    expect(h.viewport().x).toBeGreaterThanOrEqual(-30)
    h.selection.cancel(); expect(h.viewport()).toEqual({ x: 0, y: 0, zoom: 1 }); expect(h.preview()).toBeNull(); expect(h.commits()).toBe(0)
  })
  it('cut and paste are separate edits, preserve immutable internal copy, center paste and refresh lineage', () => {
    const h = harness(); h.select(); const originalSource = h.selection.selected[0]!.source
    h.selection.remove(true); expect(h.scene.strokes).toHaveLength(1); expect(h.selection.hasSelection).toBe(false)
    h.selection.insert(); const selected = h.selection.selected[0]!
    expect(selected.source).not.toBe(originalSource)
    const bounds = visibleBounds([selected])!
    expect((bounds.left + bounds.right) / 2).toBe(400); expect((bounds.top + bounds.bottom) / 2).toBe(300)
    expect(h.commits()).toBe(2); h.history.undo(); h.history.undo(); expect(h.scene.strokes).toHaveLength(1)
  })
  it('a held nudge is one action, can be cancelled, and duplicates use 24 CSS pixels', () => {
    const h = harness(); h.selection.all(); h.selection.nudge(1, 0); h.selection.nudge(10, 0)
    expect(h.commits()).toBe(0); h.selection.finishNudge(); expect(h.commits()).toBe(1)
    expect(h.selection.selected[0]!.translation!.x).toBe(11)
    h.selection.nudge(1, 0); h.selection.cancel(); expect(h.selection.selected[0]!.translation!.x).toBe(11)
    h.selection.insert(true); expect(h.selection.selected[0]!.translation!.x).toBe(35)
  })
  it('validation failure preserves scene, selection and redo without partial delete/paste', () => {
    const h = harness(); h.selection.all(); h.selection.insert(true); h.history.undo(); h.selection.clear(); h.select()
    const originals = [...h.scene.strokes], selected = h.selection.selected, before = h.commits()
    h.fail(); h.selection.remove(true)
    expect(h.scene.strokes).toEqual(originals); expect(h.selection.selected).toEqual(selected)
    expect(h.commits()).toBe(before); expect(h.history.canRedo).toBe(true); expect(h.selection.message).toBe('limit')
  })
  it('read-only supports selection/copy while guarding every mutation', () => {
    const h = harness([ink()], false); h.select(); h.selection.copy(); h.selection.remove(true); h.selection.insert(); h.selection.nudge(1, 0)
    expect(h.selection.hasSelection).toBe(true); expect(h.selection.hasClipboard).toBe(true); expect(h.commits()).toBe(0)
    expect(h.selection.down(pointer(30, 50))).toBe(true); expect(h.selection.moving).toBe(false)
  })
  it('fixes membership when moved over unrelated ink and supports lasso', () => {
    const h = harness([ink(), { ...ink(2), points: [{ x: 150, y: 50, time: 0, pressure: 1 }] }])
    h.selection.shape = 'lasso'; h.selection.down(pointer(20, 40)); h.selection.move(pointer(40, 40)); h.selection.move(pointer(40, 60)); h.selection.move(pointer(20, 60)); h.selection.up(pointer(20, 40, { buttons: 0 }))
    expect(h.selection.selected).toHaveLength(1)
    h.selection.down(pointer(30, 50)); h.selection.up(pointer(150, 50, { buttons: 0 }))
    expect(h.selection.selected).toHaveLength(1); expect(h.scene.strokes.some(s => s.id === 2 && !s.translation)).toBe(true)
  })
})

describe('selection primary-button contract', () => {
  it.each([['mouse', 3], ['mouse', 5], ['pen', 3]] as const)('cancels %s chord/buttons=%s without committing preview', (pointerType, buttons) => {
    const h = harness(), original = h.scene.strokes[0]
    h.selection.all(); h.selection.down(pointer(30, 50, { pointerType })); h.selection.move(pointer(40, 50, { pointerType }))
    expect(h.preview()).not.toBeNull()
    h.selection.move(pointer(50, 50, { pointerType, buttons }))
    expect(h.selection.pointerId).toBeNull(); expect(h.preview()).toBeNull()
    expect(h.selection.up(pointer(60, 50, { pointerType, button: 2, buttons: 0 }))).toBe(false)
    expect(h.scene.strokes[0]).toBe(original); expect(h.commits()).toBe(0); expect(h.history.canUndo).toBe(false)
    expect(h.selection.hasSelection).toBe(true)
  })
  it.each(['mouse', 'pen'])('ignores a secondary %s release until primary release or cancel', (pointerType) => {
    const h = harness(); h.selection.all(); h.selection.down(pointer(30, 50, { pointerType })); h.selection.move(pointer(40, 50, { pointerType }))
    expect(h.selection.up(pointer(70, 50, { pointerType, button: 2, buttons: 1 }))).toBe(false)
    expect(h.selection.pointerId).toBe(1); expect(h.commits()).toBe(0)
    h.selection.up(pointer(50, 50, { pointerType, button: 0, buttons: 0 }))
    expect(h.commits()).toBe(1); expect(h.selection.selected[0]!.translation!.x).toBe(20)
  })
})

describe('selection batch budgets', () => {
  it('duplicates 10000 dots into a supported 20000-item scene in one transaction', () => {
    const dots = Array.from({ length: 10000 }, (_, i) => ({ ...ink(i + 1), points: [{ x: i % 100, y: Math.floor(i / 100), pressure: 1, time: 0 }] }))
    const h = harness(dots); h.selection.all()
    const start = performance.now(); h.selection.insert(true)
    expect(h.scene.strokes).toHaveLength(20000); expect(h.commits()).toBe(1)
    expect(new Set(h.scene.strokes.map(stroke => stroke.id)).size).toBe(20000)
    expect(performance.now() - start).toBeLessThan(2000)
  })
  it('preflights item and repeated point budgets without changing selection/history', () => {
    const dots = Array.from({ length: 10001 }, (_, i) => ({ ...ink(i + 1), points: [{ x: 0, y: 50, pressure: 1, time: 0 }] }))
    const h = harness(dots); h.selection.all(); h.selection.insert(true)
    expect(h.selection.message).toContain('20 000'); expect(h.scene.strokes).toHaveLength(10001); expect(h.commits()).toBe(0)
    const point = { x: 0, y: 50, pressure: 1, time: 0 }, repeated = Array.from({ length: 100000 }, () => point)
    const points = harness(Array.from({ length: 6 }, (_, i) => ({ ...ink(i + 1), points: repeated })))
    points.selection.all(); points.selection.insert(true)
    expect(points.selection.message).toContain('1 000 000'); expect(points.commits()).toBe(0); expect(points.selection.selected).toHaveLength(6)
  })
})
