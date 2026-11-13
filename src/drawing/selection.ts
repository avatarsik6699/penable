import { cloneDocument, DOCUMENT_LIMITS, emptyDocument } from '../document/codec'
import { createStrokeIdAllocator } from '../document/stroke-ids'
import { cloneMask, contains, lasso, newSource, rectangle, sourceOf, REGION_LIMITS, selectParts, visibleBounds, type SelectedPart } from './regions'
import { screenToWorld } from './viewport'
import type { ClipMask, PointerInput, Position, Scene, SelectionShape, Stroke, Viewport } from './types'

interface SelectionOptions {
  scene: Scene
  clipboard?: { strokes: Stroke[] }
  viewport: () => Viewport
  bounds: () => { left: number; top: number; width: number; height: number }
  writable: () => boolean
  validate: (strokes: Stroke[]) => void
  commit: (strokes: Stroke[]) => void
  preview: (strokes: Stroke[] | null) => void
  changed: () => void
  setViewport: (viewport: Viewport) => void
}
interface Contact { pointerId: number; start: Position; current: Position; points: Position[]; viewport: Viewport; moving: boolean }
const tabClipboard: { strokes: Stroke[] } = { strokes: [] }
const ZERO = { x: 0, y: 0 }
function shifted(stroke: Stroke, delta: Position): Stroke {
  if (!delta.x && !delta.y) return stroke
  const offset = stroke.translation ?? ZERO
  return { ...stroke, source: sourceOf(stroke), translation: { x: offset.x + delta.x, y: offset.y + delta.y } }
}
function copy(strokes: readonly Stroke[]): Stroke[] { return cloneDocument({ ...emptyDocument(), strokes: [...strokes] }).strokes }

// Membership and geometry previews live here; the canonical scene is changed only after
// the complete replacement has passed the document limits and topology checks.
export class BoardSelection {
  shape: SelectionShape = 'rectangle'
  private parts: SelectedPart[] = []
  private contact: Contact | null = null
  private get buffer(): Stroke[] { return (this.options.clipboard ?? tabClipboard).strokes }
  private set buffer(strokes: Stroke[]) { (this.options.clipboard ?? tabClipboard).strokes = strokes }
  private delta: Position = { ...ZERO }
  private nudging = false
  message = ''
  constructor(private readonly options: SelectionOptions) {}
  get pointerId(): number | null { return this.contact?.pointerId ?? null }
  get busy(): boolean { return this.contact !== null || this.nudging }
  get moving(): boolean { return Boolean(this.contact?.moving) }
  get hasClipboard(): boolean { return this.buffer.length > 0 }
  get selected(): Stroke[] { return this.parts.map(part => shifted(part.selected, this.delta)) }
  get hasSelection(): boolean { return this.parts.length > 0 }
  get outline(): ClipMask {
    if (this.contact && !this.contact.moving) {
      try { return this.shape === 'rectangle' ? rectangle(this.contact.start, this.contact.current) : lasso(this.contact.points) } catch { return [] }
    }
    const bounds = visibleBounds(this.selected)
    return bounds ? rectangle({ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }) : []
  }
  hit(point: Position): boolean { return this.hasSelection && contains(this.outline, point) }
  private world(event: Pick<PointerInput, 'clientX' | 'clientY'>): Position {
    const bounds = this.options.bounds()
    return screenToWorld({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }, this.options.viewport())
  }
  private report(error: unknown) { this.message = error instanceof Error ? error.message : 'Не удалось обработать выделение.'; this.options.changed() }
  private allocate() { return createStrokeIdAllocator(this.options.scene.strokes) }
  down(event: PointerInput): boolean {
    if (this.busy || !event.isPrimary || event.button !== 0 || event.buttons !== 1 || !['pen', 'mouse'].includes(event.pointerType)
      || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false
    const point = this.world(event)
    const moving = this.options.writable() && this.hit(point)
    this.contact = { pointerId: event.pointerId, start: point, current: point, points: [point], viewport: { ...this.options.viewport() }, moving }
    this.delta = { ...ZERO }; this.message = ''; this.options.changed(); return true
  }
  move(event: PointerInput): boolean {
    const contact = this.contact
    if (!contact || contact.pointerId !== event.pointerId) return false
    if (event.buttons !== 1) { this.cancel(); return true }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return true
    contact.current = this.world(event)
    if (contact.moving) {
      this.delta = { x: contact.current.x - contact.start.x, y: contact.current.y - contact.start.y }
      this.options.preview(this.candidate(this.delta).strokes)
    } else if (this.shape === 'lasso') {
      const last = contact.points.at(-1)!
      if (Math.hypot(last.x - contact.current.x, last.y - contact.current.y) * this.options.viewport().zoom >= 2) {
        if (contact.points.length >= REGION_LIMITS.lasso) { this.cancel(); this.report(new Error('Лассо: предел 2048 вершин. Попробуйте более короткую границу.')); return true }
        contact.points.push(contact.current)
      }
    }
    this.options.changed(); return true
  }
  up(event: PointerInput): boolean {
    const contact = this.contact
    if (!contact || contact.pointerId !== event.pointerId || event.button !== 0) return false
    // Pointer-up commonly has buttons=0; capture its final position without cancelling.
    this.move({ pointerId: event.pointerId, pointerType: event.pointerType, isPrimary: event.isPrimary, button: event.button, buttons: 1, clientX: event.clientX, clientY: event.clientY, pressure: event.pressure, timeStamp: event.timeStamp })
    if (!this.contact) return true
    this.contact = null
    if (contact.moving) this.finishMove(contact.viewport)
    else {
      try {
        const mask = this.shape === 'rectangle' ? rectangle(contact.start, contact.current) : lasso(contact.points)
        const parts = selectParts(this.options.scene.strokes, mask, this.allocate())
        this.parts = parts; this.message = ''
      } catch (error) { this.report(error) }
      this.options.changed()
    }
    return true
  }
  private candidate(delta: Position, remove = false): { strokes: Stroke[]; selected: Stroke[] } {
    const byOriginal = new Map(this.parts.map(part => [part.original, part]))
    const selected: Stroke[] = []
    const strokes = this.options.scene.strokes.flatMap(stroke => {
      const part = byOriginal.get(stroke)
      if (!part) return [stroke]
      const result: Stroke[] = []
      if (part.remainder) result.push(part.remainder)
      if (!remove) { const moved = shifted(part.selected, delta); selected.push(moved); result.push(moved) }
      return result
    })
    return { strokes, selected }
  }
  private apply(candidate: { strokes: Stroke[]; selected: Stroke[] }) {
    this.options.validate(candidate.strokes)
    this.options.commit(candidate.strokes)
    this.parts = candidate.selected.map(stroke => ({ original: stroke, selected: stroke, remainder: null }))
    this.message = ''
  }
  private finishMove(viewport?: Viewport) {
    try { if (this.delta.x || this.delta.y) this.apply(this.candidate(this.delta)) }
    catch (error) { if (viewport) this.options.setViewport(viewport); this.report(error) }
    this.delta = { ...ZERO }; this.nudging = false; this.options.preview(null); this.options.changed()
  }
  cancel(): boolean {
    const contact = this.contact
    const active = this.busy
    this.contact = null; this.nudging = false; this.delta = { ...ZERO }
    this.options.preview(null)
    if (contact?.moving) this.options.setViewport(contact.viewport)
    this.options.changed(); return active
  }
  clear() { if (this.busy) { this.cancel(); return }; this.parts = []; this.message = ''; this.options.changed() }
  all() {
    if (this.busy) return
    this.parts = this.options.scene.strokes.map(stroke => ({ original: stroke, selected: stroke, remainder: null }))
    this.message = ''; this.options.changed()
  }
  copy(): void { if (!this.busy && this.hasSelection) { this.buffer = copy(this.selected); this.message = 'Фрагмент скопирован в этой вкладке.'; this.options.changed() } }
  remove(cut = false): void {
    if (this.busy || !this.options.writable() || !this.hasSelection) return
    try {
      const candidate = this.candidate(ZERO, true)
      this.options.validate(candidate.strokes)
      const buffer = cut ? copy(this.selected) : null
      this.apply(candidate)
      if (buffer) this.buffer = buffer
    } catch (error) { this.report(error) }
    this.options.changed()
  }
  insert(duplicate = false): void {
    if (this.busy || !this.options.writable()) return
    try {
      const originals = duplicate ? this.selected : this.buffer
      if (this.options.scene.strokes.length + originals.length > DOCUMENT_LIMITS.strokes) throw new Error('Вставка превышает предел 20 000 фрагментов. Выделите меньше записей.')
      const points = (strokes: readonly Stroke[]) => strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)
      if (points(this.options.scene.strokes) + points(originals) > DOCUMENT_LIMITS.points) throw new Error('Вставка превышает предел 1 000 000 точек. Выделите меньше записей.')
      const bounds = visibleBounds(originals)
      if (!bounds) return
      const viewport = this.options.viewport(), size = this.options.bounds()
      const center = screenToWorld({ x: size.width / 2, y: size.height / 2 }, viewport)
      const delta = duplicate ? { x: 24 / viewport.zoom, y: 24 / viewport.zoom }
        : { x: center.x - (bounds.left + bounds.right) / 2, y: center.y - (bounds.top + bounds.bottom) / 2 }
      const allocate = this.allocate(), sources = new Map<string | Stroke, string>()
      const selected = copy(originals).map((stroke, index) => {
        const key = originals[index]!.source ?? originals[index]!
        let source = sources.get(key)
        if (!source) { source = newSource(); sources.set(key, source) }
        return { ...shifted(stroke, delta), id: allocate(), source, ...(stroke.clip ? { clip: cloneMask(stroke.clip) } : {}) }
      })
      this.apply({ strokes: [...this.options.scene.strokes, ...selected], selected })
    } catch (error) { this.report(error) }
    this.options.changed()
  }
  nudge(x: number, y: number): void {
    if (this.contact || !this.options.writable() || !this.hasSelection) return
    this.nudging = true
    this.delta = { x: this.delta.x + x / this.options.viewport().zoom, y: this.delta.y + y / this.options.viewport().zoom }
    this.options.preview(this.candidate(this.delta).strokes); this.options.changed()
  }
  finishNudge() { if (this.nudging) this.finishMove() }
  edgePan(screen: Position, elapsed: number): boolean {
    if (!this.contact?.moving) return false
    const bounds = this.options.bounds(), viewport = this.options.viewport()
    const speed = (p: number, size: number) => p < 32 ? 600 * Math.min(1, (32 - p) / 32) ** 2
      : p > size - 32 ? -600 * Math.min(1, (p - size + 32) / 32) ** 2 : 0
    const x = speed(screen.x, bounds.width) * Math.min(0.05, Math.max(0, elapsed))
    const y = speed(screen.y, bounds.height) * Math.min(0.05, Math.max(0, elapsed))
    if (!x && !y) return false
    this.options.setViewport({ ...viewport, x: viewport.x + x, y: viewport.y + y })
    this.move({ pointerId: this.contact.pointerId, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1,
      clientX: screen.x + bounds.left, clientY: screen.y + bounds.top, pressure: 0, timeStamp: 0 })
    return true
  }
}
