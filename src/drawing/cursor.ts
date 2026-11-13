import type { DrawingTool, PointerInput, Position } from './types'

export type CursorMode = DrawingTool | 'move' | 'pan-ready' | 'panning'
export interface CursorBounds { left: number; top: number; width: number; height: number }
export interface CursorPresentation { position: Position | null; visible: boolean; mode: CursorMode }
type CursorPointer = Pick<PointerInput, 'pointerId' | 'pointerType' | 'clientX' | 'clientY'>

// Presentation uses CSS pixels only; document coordinates and backing density never enter here.
export class BoardCursor {
  private position: Position | null = null
  private inside = false
  private available = true
  private mode: CursorMode = 'pen'
  private owner: number | null = null
  private lastPointer: number | null = null

  get presentation(): CursorPresentation {
    return { position: this.position, visible: this.available && this.inside && this.position !== null, mode: this.mode }
  }

  configure(mode: CursorMode, available: boolean): void {
    this.mode = mode
    this.available = available
  }

  begin(pointerId: number): void { this.owner = pointerId }
  end(pointerId?: number): void {
    if (pointerId === undefined || this.owner === pointerId) this.owner = null
  }

  move(event: CursorPointer, bounds: CursorBounds, overBoard: boolean): void {
    if (!this.accepts(event)) return
    if (![event.clientX, event.clientY, bounds.left, bounds.top, bounds.width, bounds.height].every(Number.isFinite)) return
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    this.lastPointer = event.pointerId
    this.inside = overBoard && x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height
    if (this.inside) this.position = { x, y }
  }

  leave(event: CursorPointer, overUI = false): void {
    if (!this.accepts(event) || (this.lastPointer !== null && event.pointerId !== this.lastPointer)) return
    // Digitizer proximity leave coordinates may be 0,0. Keep the last valid sample.
    if (event.pointerType !== 'pen' || overUI) this.inside = false
  }

  hide(): void { this.inside = false }
  cancel(): void { this.owner = null; this.hide() }

  private accepts(event: CursorPointer): boolean {
    return (event.pointerType === 'pen' || event.pointerType === 'mouse')
      && (this.owner === null || event.pointerId === this.owner)
  }
}
