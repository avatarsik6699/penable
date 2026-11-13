import { DOCUMENT_LIMITS } from '../document/codec'
import { createStrokeIdAllocator } from '../document/stroke-ids'
import { cloneMask, contains, lasso, newSource, rectangle, sourceOf, REGION_LIMITS, selectParts, visibleBounds, maskBounds, translateMask, type SelectedPart } from './regions'
import type { RegionInput } from '../document/jobs-protocol'
import { screenToWorld } from './viewport'
import type { ClipMask, PointerInput, Position, Scene, SelectionShape, Stroke, Viewport } from './types'

export interface SelectionPreview { stationary: readonly Stroke[]; selected: readonly Stroke[]; delta: Position }
interface SelectionClipboard { strokes: Stroke[]; region?: ClipMask }
interface SelectionOptions {
  scene: Scene
  clipboard?: SelectionClipboard
  viewport: () => Viewport
  bounds: () => { left: number; top: number; width: number; height: number }
  writable: () => boolean
  select?: (input: RegionInput, signal: AbortSignal) => { region: ClipMask; parts: SelectedPart[] } | Promise<{ region: ClipMask; parts: SelectedPart[] }>
  validate: (strokes: Stroke[], signal: AbortSignal) => void | Promise<void>
  commit: (strokes: Stroke[]) => void
  preview: (preview: SelectionPreview | null) => void
  changed: () => void
  setViewport: (viewport: Viewport) => void
}
interface Contact { pointerId: number; start: Position; current: Position; points: Position[]; viewport: Viewport; moving: boolean }
const tabClipboard: SelectionClipboard = { strokes: [] }
const ZERO = { x: 0, y: 0 }
function shifted(stroke: Stroke, delta: Position): Stroke {
  if (!delta.x && !delta.y) return stroke
  const offset = stroke.translation ?? ZERO
  return { ...stroke, source: sourceOf(stroke), translation: { x: offset.x + delta.x, y: offset.y + delta.y } }
}
function copy(strokes: readonly Stroke[]): Stroke[] { return [...strokes] }

export function prepareSelection(strokes: readonly Stroke[], input: RegionInput): { region: ClipMask; parts: SelectedPart[] } {
  const bounds = input.shape === 'all' ? visibleBounds(strokes) : null
  const region = input.shape === 'all' ? bounds ? rectangle({ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }) : []
    : input.shape === 'rectangle' ? rectangle(input.points[0]!, input.points.at(-1)!) : lasso(input.points)
  const parts = input.shape === 'all' ? strokes.map(original => ({ original, selected: original, remainder: null })) : selectParts(strokes, region, createStrokeIdAllocator(strokes))
  return { region, parts }
}

// Membership and geometry previews live here; the canonical scene is changed only after
// the complete replacement has passed the document limits and topology checks.
export class BoardSelection {
  shape: SelectionShape = 'rectangle'
  private parts: SelectedPart[] = []
  private contact: Contact | null = null
  private pending: AbortController | null = null
  private pendingOutline: ClipMask | null = null
  private rollbackViewport: Viewport | null = null
  private region: ClipMask = []
  private previewBase: Omit<SelectionPreview, 'delta'> | null = null
  private get clipboard(): SelectionClipboard { return this.options.clipboard ?? tabClipboard }
  private get buffer(): Stroke[] { return this.clipboard.strokes }
  private delta: Position = { ...ZERO }
  private nudging = false
  message = ''
  constructor(private readonly options: SelectionOptions) {}
  get pointerId(): number | null { return this.contact?.pointerId ?? null }
  get busy(): boolean { return this.contact !== null || this.nudging || this.pending !== null }
  get moving(): boolean { return Boolean(this.contact?.moving) }
  get hasClipboard(): boolean { return this.buffer.length > 0 }
  get selected(): Stroke[] { return this.parts.map(part => shifted(part.selected, this.delta)) }
  get hasSelection(): boolean { return this.parts.length > 0 }
  get outline(): ClipMask {
    if (this.pendingOutline) return this.pendingOutline
    if (this.contact && !this.contact.moving) {
      // The live path needs no Boolean normalization on every pen sample.
      return this.shape === 'rectangle' ? rectangle(this.contact.start, this.contact.current)
        : this.contact.points.length < 3 ? [] : [[this.contact.points.concat(this.contact.points[0]!).map(({ x, y }) => [x, y])]]
    }
    return this.delta.x || this.delta.y ? translateMask(this.region, this.delta) : this.region
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
    this.delta = { ...ZERO }; this.previewBase = null; this.message = ''; this.options.changed(); return true
  }
  move(event: PointerInput): boolean {
    const contact = this.contact
    if (!contact || contact.pointerId !== event.pointerId) return false
    if (event.buttons !== 1) { this.cancel(); return true }
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return true
    contact.current = this.world(event)
    if (contact.moving) {
      this.delta = { x: contact.current.x - contact.start.x, y: contact.current.y - contact.start.y }
      this.previewMove()
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
    else this.selectRegion({ shape: this.shape, points: this.shape === 'rectangle' ? [contact.start, contact.current] : contact.points })

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
  private previewMove() {
    if (!this.previewBase) {
      const byOriginal = new Map(this.parts.map(part => [part.original, part]))
      this.previewBase = { stationary: this.options.scene.strokes.flatMap(stroke => {
        const part = byOriginal.get(stroke)
        return part ? part.remainder ? [part.remainder] : [] : [stroke]
      }), selected: this.parts.map(part => part.selected) }
    }
    this.options.preview({ ...this.previewBase, delta: this.delta })
  }
  private perform<T>(prepare: (signal: AbortSignal) => T | Promise<T>, accept: (value: T) => void, finish: (success: boolean) => void = () => {}, outline: ClipMask | null = null) {
    const pending = new AbortController()
    this.pending = pending
    const complete = (success: boolean, value?: T, error?: unknown) => {
      if (this.pending !== pending || pending.signal.aborted) return
      this.pending = null; this.pendingOutline = null
      if (success) {
        try { accept(value as T) } catch (failure) { success = false; error = failure }
      }
      finish(success)
      if (!success) this.report(error)
      this.options.changed()
    }
    try {
      const result = prepare(pending.signal)
      if (result && typeof (result as Promise<T>).then === 'function') {
        this.pendingOutline = outline
        this.message = 'Подготовка выделения… Esc — отмена.'
        this.options.changed()
        void Promise.resolve(result).then(value => complete(true, value), error => complete(false, undefined, error))
      } else complete(true, result as T)
    } catch (error) { complete(false, undefined, error) }
  }
  private selectRegion(input: RegionInput) {
    const outline = input.shape === 'all' ? null : input.shape === 'rectangle' ? rectangle(input.points[0]!, input.points.at(-1)!)
      : input.points.length < 3 ? [] : [[input.points.concat(input.points[0]!).map(({ x, y }) => [x, y])]] as ClipMask
    this.perform(signal => {
      if (this.options.select) return this.options.select(input, signal)
      return prepareSelection(this.options.scene.strokes, input)
    }, result => { this.parts = result.parts; this.region = result.region; this.message = '' }, () => {}, outline)
  }
  private apply(candidate: { strokes: Stroke[]; selected: Stroke[] }, region = this.region, finish: (success: boolean) => void = () => {}) {
    if (candidate.strokes.length > DOCUMENT_LIMITS.strokes) {
      finish(false)
      const reason = this.options.scene.strokes.length >= DOCUMENT_LIMITS.strokes ? 'На доске достигнут предел 20 000 фрагментов.' : 'Действие превысит предел 20 000 фрагментов.'
      this.report(new Error(reason + ' Перенос части штриха создаёт дополнительные фрагменты. Выделите штрихи целиком или удалите ненужные записи.'))
      return
    }
    const before = [...this.options.scene.strokes]
    this.perform(signal => this.options.validate(candidate.strokes, signal), () => {
      if (!this.options.writable() || before.length !== this.options.scene.strokes.length || before.some((stroke, index) => stroke !== this.options.scene.strokes[index])) throw new Error('Доска изменилась. Повторите действие.')
      this.options.commit(candidate.strokes)
      this.parts = candidate.selected.map(stroke => ({ original: stroke, selected: stroke, remainder: null }))
      this.region = region; this.previewBase = null; this.message = ''
    }, finish)
  }
  private finishMove(viewport?: Viewport) {
    const finish = (success: boolean) => {
      if (!success && viewport) this.options.setViewport(viewport)
      this.rollbackViewport = null; this.delta = { ...ZERO }; this.previewBase = null; this.nudging = false; this.options.preview(null); this.options.changed()
    }
    if (this.delta.x || this.delta.y) {
      this.rollbackViewport = viewport ?? null
      this.apply(this.candidate(this.delta), translateMask(this.region, this.delta), finish)
    } else finish(true)
  }
  cancel(): boolean {
    const contact = this.contact
    const active = this.busy
    if (this.pending) this.message = ''
    this.pending?.abort(); this.pending = null; this.pendingOutline = null
    this.contact = null; this.nudging = false; this.delta = { ...ZERO }; this.previewBase = null
    this.options.preview(null)
    if (contact?.moving || this.rollbackViewport) this.options.setViewport(contact?.moving ? contact.viewport : this.rollbackViewport!)
    this.rollbackViewport = null
    this.options.changed(); return active
  }
  clear() { if (this.busy) { this.cancel(); return }; this.parts = []; this.region = []; this.message = ''; this.options.changed() }
  all() { if (!this.busy) this.selectRegion({ shape: 'all', points: [] }) }
  copy(): void { if (!this.busy && this.hasSelection) { this.clipboard.strokes = copy(this.selected); this.clipboard.region = cloneMask(this.outline); this.message = 'Фрагмент скопирован в этой вкладке.'; this.options.changed() } }
  remove(cut = false): void {
    if (this.busy || !this.options.writable() || !this.hasSelection) return
    try {
      const candidate = this.candidate(ZERO, true)
      const buffer = cut ? copy(this.selected) : null
      const region = cloneMask(this.outline)
      this.apply(candidate, [], success => { if (success && buffer) { this.clipboard.strokes = buffer; this.clipboard.region = region } })
    } catch (error) { this.report(error) }
    this.options.changed()
  }
  insert(duplicate = false): void {
    if (this.busy || !this.options.writable()) return
    try {
      const originals = duplicate ? this.selected : this.buffer
      if (!originals.length) return
      if (this.options.scene.strokes.length + originals.length > DOCUMENT_LIMITS.strokes) throw new Error('Вставка превышает предел 20 000 фрагментов. Выделите меньше записей.')
      const points = (strokes: readonly Stroke[]) => strokes.reduce((sum, stroke) => sum + stroke.points.length, 0)
      if (points(this.options.scene.strokes) + points(originals) > DOCUMENT_LIMITS.points) throw new Error('Вставка превышает предел 1 000 000 точек. Выделите меньше записей.')
      const region = duplicate ? this.outline : this.clipboard.region ?? []
      const bounds = maskBounds(region) ?? visibleBounds(originals)
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
        return { ...shifted(stroke, delta), id: allocate(), source }
      })
      this.apply({ strokes: [...this.options.scene.strokes, ...selected], selected }, translateMask(region.length ? region : rectangle({ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }), delta))
    } catch (error) { this.report(error) }
    this.options.changed()
  }
  nudge(x: number, y: number): void {
    if (this.contact || this.pending || !this.options.writable() || !this.hasSelection) return
    this.nudging = true
    this.delta = { x: this.delta.x + x / this.options.viewport().zoom, y: this.delta.y + y / this.options.viewport().zoom }
    this.previewMove(); this.options.changed()
  }
  finishNudge() { if (this.nudging && !this.pending) this.finishMove() }
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
