import { bitmapSize, validDpr } from './coordinates'
import { strokeGeometry } from './geometry'
import { stabilizedPositions } from './stabilization'
import type { Scene, Stroke, Viewport } from './types'

export interface CanvasLayer {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
}

export interface FrameScheduler {
  request: (callback: () => void) => number
  cancel: (handle: number) => void
}

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
}

export class CanvasRenderer {
  private width = -1
  private height = -1
  private dpr = -1
  private nativeScale = -1
  private viewport: Viewport
  private raster = bitmapSize(1, 1, 1)
  private frameId: number | null = null
  private fullDirty = true
  private liveDirty = false
  private resizePending = false
  private commits: Stroke[] = []
  private disposed = false
  private preview: ReadonlySet<Stroke> = new Set()

  constructor(
    private readonly completed: CanvasLayer,
    private readonly live: CanvasLayer,
    private readonly scene: Scene,
    viewport: Viewport,
    private readonly frames: FrameScheduler = browserFrames,
  ) {
    this.viewport = viewport
  }

  get resolution() { return this.raster }

  needsResize(width: number, height: number, dpr: number, nativeScale = 1): boolean {
    return this.width !== width || this.height !== height
      || this.dpr !== validDpr(dpr) || this.nativeScale !== validDpr(nativeScale)
  }

  resize(width: number, height: number, dpr: number, nativeScale = 1) {
    if (!this.needsResize(width, height, dpr, nativeScale)) return
    this.width = width
    this.height = height
    this.dpr = validDpr(dpr)
    this.nativeScale = validDpr(nativeScale)
    this.raster = bitmapSize(width, height, this.dpr, this.nativeScale)
    this.resizePending = true
    this.fullDirty = true
    this.schedule()
  }

  setViewport(viewport: Viewport) {
    if (this.viewport.zoom === viewport.zoom && this.viewport.x === viewport.x && this.viewport.y === viewport.y) return
    this.viewport = viewport
    this.fullDirty = true
    this.schedule()
  }

  activeChanged() {
    this.liveDirty = true
    this.schedule()
  }

  commit(stroke: Stroke) {
    // Every finished stroke survives even if several contacts happen before the next RAF.
    this.commits.push(stroke)
    this.liveDirty = true
    this.schedule()
  }

  setEraserPreview(preview: ReadonlySet<Stroke>) {
    this.preview = preview
    this.sceneChanged()
  }

  sceneChanged() {
    this.commits = []
    this.fullDirty = true
    this.liveDirty = true
    this.schedule()
  }

  dispose() {
    this.disposed = true
    if (this.frameId !== null) this.frames.cancel(this.frameId)
    this.frameId = null
    this.commits = []
  }

  private schedule() {
    if (this.disposed || this.frameId !== null) return
    this.frameId = this.frames.request(() => this.flush())
  }

  private flush() {
    this.frameId = null
    if (this.disposed) return
    if (this.resizePending) {
      const layers = [this.completed, this.live]
      // Release shrinking dimensions on both layers before allocating any larger dimension.
      for (const { canvas } of layers) {
        if (canvas.width > this.raster.width) canvas.width = this.raster.width
        if (canvas.height > this.raster.height) canvas.height = this.raster.height
      }
      for (const { canvas } of layers) {
        if (canvas.width < this.raster.width) canvas.width = this.raster.width
        if (canvas.height < this.raster.height) canvas.height = this.raster.height
      }
      this.resizePending = false
    }
    if (this.fullDirty) {
      this.clear(this.completed)
      for (const stroke of this.scene.strokes) {
        if (!this.preview.has(stroke)) this.drawStroke(this.completed.context, stroke)
      }
    } else {
      for (const stroke of this.commits) {
        if (!this.preview.has(stroke)) this.drawStroke(this.completed.context, stroke)
      }
    }
    if (this.fullDirty || this.liveDirty) {
      this.clear(this.live)
      if (this.scene.active) this.drawStroke(this.live.context, this.scene.active)
    }
    this.commits = []
    this.fullDirty = false
    this.liveDirty = false
  }

  private clear(layer: CanvasLayer) {
    layer.context.setTransform(1, 0, 0, 1, 0, 0)
    layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
  }

  private drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const { scaleX, scaleY } = this.raster
    const { zoom, x, y } = this.viewport
    ctx.setTransform(scaleX * zoom, 0, 0, scaleY * zoom, scaleX * x, scaleY * y)
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const geometry = strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width)
    if (geometry.kind === 'empty') return
    ctx.beginPath()
    if (geometry.kind === 'dot') {
      ctx.arc(geometry.x, geometry.y, geometry.radius, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    for (const command of geometry.commands) {
      if (command.kind === 'move') ctx.moveTo(command.x, command.y)
      else if (command.kind === 'line') ctx.lineTo(command.x, command.y)
      else ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
    }
    ctx.stroke()
  }
}
