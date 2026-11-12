import { toScenePoint, type SurfaceBounds } from './coordinates'
import { INK, type Point, type PointerInput, type PointerSample, type Scene, type Stroke } from './types'

interface InputOptions {
  scene: Scene
  bounds: () => SurfaceBounds
  width: () => number
  draw: (stroke: Stroke, points: Point[], previous: Point | null) => void
  redraw: () => void
}

function sameSample(a: PointerSample, b: PointerSample) {
  return a.pointerId === b.pointerId && a.clientX === b.clientX && a.clientY === b.clientY
    && a.pressure === b.pressure && a.timeStamp === b.timeStamp
}

export function eventSamples(event: PointerInput): PointerSample[] {
  let samples: PointerSample[] = []
  try {
    samples = event.getCoalescedEvents?.() ?? []
  } catch {
    // Capability detection cannot guarantee that every browser event supports the call.
  }
  if (!samples.length) return [event]
  // The parent is an aggregate of these samples, not an additional position.
  return samples.filter((sample, index) =>
    !samples.slice(0, index).some((previous) => sameSample(previous, sample)))
}

export class PenInput {
  private nextId = 1

  constructor(private readonly options: InputOptions) {}

  get pointerId(): number | null {
    return this.options.scene.active?.pointerId ?? null
  }

  down(event: PointerInput): boolean {
    if (this.pointerId !== null || !event.isPrimary || event.button !== 0 || event.buttons !== 1
      || (event.pointerType !== 'pen' && event.pointerType !== 'mouse')) return false
    const point = toScenePoint(event, this.options.bounds())
    if (!point) return false
    const requestedWidth = this.options.width()
    const width = Number.isFinite(requestedWidth) ? Math.min(12, Math.max(1, requestedWidth)) : 3
    const stroke = {
      id: this.nextId++, color: INK, width, pointerId: event.pointerId, points: [point],
    }
    this.options.scene.active = stroke
    this.options.draw(stroke, [point], null)
    return true
  }

  move(event: PointerInput): boolean {
    if (event.pointerId !== this.pointerId) return false
    if (event.buttons !== 1) {
      this.cancel(event.pointerId)
      return false
    }
    this.append(event)
    return true
  }

  up(event: PointerInput): boolean {
    if (event.pointerId !== this.pointerId || event.button !== 0) return false
    this.append(event)
    const { scene } = this.options
    if (scene.active) scene.strokes.push(scene.active)
    scene.active = null
    return true
  }

  cancel(pointerId?: number): boolean {
    if (this.pointerId === null || (pointerId !== undefined && pointerId !== this.pointerId)) return false
    this.options.scene.active = null
    this.options.redraw()
    return true
  }

  private append(event: PointerInput) {
    const stroke = this.options.scene.active
    if (!stroke) return
    const bounds = this.options.bounds()
    const previous = stroke.points.at(-1) ?? null
    const points: Point[] = []
    for (const sample of eventSamples(event)) {
      if (sample.pointerId !== stroke.pointerId) continue
      const point = toScenePoint(sample, bounds)
      if (!point) continue
      const last = points.at(-1) ?? previous
      if (last && point.x === last.x && point.y === last.y
        && point.pressure === last.pressure && point.time === last.time) continue
      points.push(point)
    }
    if (!points.length) return
    stroke.points.push(...points)
    this.options.draw(stroke, points, previous)
  }
}
