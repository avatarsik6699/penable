import type { PointerInput, Position, Viewport } from './types'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 8

export function initialViewport(): Viewport {
  return { zoom: 1, x: 0, y: 0 }
}

export function worldToScreen(point: Position, viewport: Viewport): Position {
  return { x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y }
}

export function screenToWorld(point: Position, viewport: Viewport): Position {
  return { x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom }
}

export function zoomAt(viewport: Viewport, requestedZoom: number, anchor: Position): Viewport {
  if (!Number.isFinite(requestedZoom) || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) return viewport
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom))
  if (zoom === viewport.zoom) return viewport
  const world = screenToWorld(anchor, viewport)
  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom }
}

interface NavigationOptions {
  viewport: Viewport
  isDrawing: () => boolean
  onChange: (viewport: Viewport) => void
  clock?: () => number
}

export interface BoardWheel {
  deltaX: number
  deltaY: number
  deltaMode: number
  ctrlKey: boolean
  shiftKey: boolean
  anchor: Position
  width: number
  height: number
}

interface PanContact {
  pointerId: number
  buttonMask: number
  origin: Position
  viewport: Viewport
}

export class BoardNavigation {
  private current: Viewport
  private pan: PanContact | null = null
  private lastWheel = -Infinity
  private wheelQuarantined = false

  constructor(private readonly options: NavigationOptions) {
    this.current = options.viewport
  }

  get viewport(): Viewport { return this.current }
  get pointerId(): number | null { return this.pan?.pointerId ?? null }

  setZoom(zoom: number, anchor: Position): boolean {
    if (this.options.isDrawing() || this.pan) return false
    return this.apply(zoomAt(this.current, zoom, anchor))
  }

  wheel(event: BoardWheel): boolean {
    const now = this.options.clock?.() ?? performance.now()
    const gap = now - this.lastWheel
    this.lastWheel = now
    if (gap >= 150) this.wheelQuarantined = false
    if (this.options.isDrawing() || this.pan) this.wheelQuarantined = true
    if (this.wheelQuarantined) return false
    const { deltaX, deltaY, deltaMode, width, height, anchor } = event
    if (![deltaX, deltaY, width, height, anchor.x, anchor.y].every(Number.isFinite)
      || width <= 0 || height <= 0 || ![0, 1, 2].includes(deltaMode)) return false
    let dx = deltaX * (deltaMode === 1 ? 16 : deltaMode === 2 ? width : 1)
    let dy = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? height : 1)
    if (event.ctrlKey) {
      const factor = Math.exp(-Math.max(-1000, Math.min(1000, dy)) * 0.002)
      return this.setZoom(this.current.zoom * factor, anchor)
    }
    if (event.shiftKey && dx === 0) { dx = dy; dy = 0 }
    return this.apply({ zoom: this.current.zoom, x: this.current.x - dx, y: this.current.y - dy })
  }

  suspendWheel(): void {
    const now = this.options.clock?.() ?? performance.now()
    if (now - this.lastWheel < 150) this.wheelQuarantined = true
  }

  reset(): boolean {
    if (this.options.isDrawing() || this.pan) return false
    return this.apply(initialViewport())
  }

  startPan(event: PointerInput, spaceDown: boolean): boolean {
    if (this.options.isDrawing() || this.pan || !event.isPrimary
      || (event.pointerType !== 'mouse' && event.pointerType !== 'pen')
      || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false
    const primary = spaceDown && event.button === 0 && event.buttons === 1
    const middle = event.pointerType === 'mouse' && event.button === 1 && event.buttons === 4
    if (!primary && !middle) return false
    this.suspendWheel()
    this.pan = {
      pointerId: event.pointerId, buttonMask: middle ? 4 : 1,
      origin: { x: event.clientX, y: event.clientY }, viewport: this.current,
    }
    return true
  }

  movePan(event: PointerInput): boolean {
    const pan = this.pan
    if (!pan || event.pointerId !== pan.pointerId) return false
    if ((event.buttons & pan.buttonMask) === 0) {
      this.pan = null
      return true
    }
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
      this.apply({
        zoom: pan.viewport.zoom,
        x: pan.viewport.x + event.clientX - pan.origin.x,
        y: pan.viewport.y + event.clientY - pan.origin.y,
      })
    }
    return true
  }

  endPan(pointerId?: number): boolean {
    if (!this.pan || (pointerId !== undefined && pointerId !== this.pan.pointerId)) return false
    this.pan = null
    return true
  }

  private apply(viewport: Viewport): boolean {
    if (![viewport.zoom, viewport.x, viewport.y].every(Number.isFinite)) return false
    if (viewport.zoom === this.current.zoom && viewport.x === this.current.x && viewport.y === this.current.y) return false
    this.current = viewport
    this.options.onChange(viewport)
    return true
  }
}
