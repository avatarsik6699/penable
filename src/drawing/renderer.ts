import { bitmapSize, validDpr } from './coordinates'
import type { Point, Scene, Stroke } from './types'

export class CanvasRenderer {
  private width = -1
  private height = -1
  private dpr = -1

  constructor(private readonly canvas: HTMLCanvasElement, private readonly context: CanvasRenderingContext2D) {}

  needsResize(width: number, height: number, dpr: number): boolean {
    return this.width !== width || this.height !== height || this.dpr !== validDpr(dpr)
  }

  resize(width: number, height: number, dpr: number, scene: Scene) {
    if (!this.needsResize(width, height, dpr)) return
    this.width = width
    this.height = height
    this.dpr = validDpr(dpr)
    const size = bitmapSize(width, height, this.dpr)
    this.canvas.width = size.width
    this.canvas.height = size.height
    this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    this.redraw(scene)
  }

  draw(stroke: Stroke, points: Point[], previous: Point | null) {
    const first = previous ?? points[0]
    if (!first) return
    const ctx = this.context
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (!previous) {
      ctx.beginPath()
      ctx.arc(first.x, first.y, stroke.width / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.moveTo(first.x, first.y)
    for (const point of points) ctx.lineTo(point.x, point.y)
    ctx.stroke()
  }

  redraw(scene: Scene) {
    this.context.clearRect(0, 0, this.width, this.height)
    for (const stroke of scene.strokes) this.draw(stroke, stroke.points, null)
    if (scene.active) this.draw(scene.active, scene.active.points, null)
  }
}
