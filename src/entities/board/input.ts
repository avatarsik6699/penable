import { type SurfaceBounds, BoardCoordinates } from "./coordinates";
import {
  type Point,
  type PointerInput,
  type PointerSample,
  type Scene,
  type Stroke,
  type Viewport,
  BoardConstants,
} from "./types";
import { BoardStabilization } from "./stabilization";
type InputOptions = {
  scene: Scene;
  bounds: () => SurfaceBounds;
  viewport: () => Viewport;
  width: () => number;
  stabilization?: () => number;
  allocateId?: () => number;
  onActiveChange: () => void;
  onCommit: (stroke: Stroke) => void;
};
function sameSample(a: PointerSample, b: PointerSample) {
  return (
    a.pointerId === b.pointerId &&
    a.clientX === b.clientX &&
    a.clientY === b.clientY &&
    a.pressure === b.pressure &&
    a.timeStamp === b.timeStamp
  );
}
function eventSamples(event: PointerInput): PointerSample[] {
  let samples: PointerSample[] = [];
  try {
    samples = event.getCoalescedEvents?.() ?? [];
  } catch {
    // Capability detection cannot guarantee that every browser event supports the call.
  }
  if (!samples.length) return [event];
  // The parent is an aggregate of these samples, not an additional position.
  return samples.filter(
    (sample, index) =>
      !samples.slice(0, index).some((previous) => sameSample(previous, sample)),
  );
}
export class PenInput {
  private nextId = 1;
  constructor(private readonly options: InputOptions) {
    for (const stroke of options.scene.strokes)
      this.nextId = Math.max(this.nextId, stroke.id + 1);
  }
  get pointerId(): number | null {
    return this.options.scene.active?.pointerId ?? null;
  }
  down(event: PointerInput): boolean {
    if (
      this.pointerId !== null ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.buttons !== 1 ||
      (event.pointerType !== "pen" && event.pointerType !== "mouse")
    )
      return false;
    const viewport = this.options.viewport();
    const point = BoardCoordinates.toScenePoint(
      event,
      this.options.bounds(),
      viewport,
    );
    if (!point) return false;
    const requestedWidth = this.options.width();
    const width = Number.isFinite(requestedWidth)
      ? Math.min(12, Math.max(0.5, requestedWidth))
      : 3;
    const id = this.options.allocateId
      ? this.options.allocateId()
      : this.nextId++;
    if (!Number.isSafeInteger(id) || id < 1) return false;
    const stroke = {
      id,
      color: BoardConstants.INK,
      width,
      pointerId: event.pointerId,
      points: [point],
      stabilization: {
        strength: BoardStabilization.normalizeStrength(
          this.options.stabilization?.() ?? 0,
        ),
        captureZoom: viewport.zoom,
      },
    };
    this.options.scene.active = stroke;
    this.options.onActiveChange();
    return true;
  }
  move(event: PointerInput): boolean {
    if (event.pointerId !== this.pointerId) return false;
    if (event.buttons !== 1) {
      this.cancel(event.pointerId);
      return false;
    }
    if (this.append(event)) this.options.onActiveChange();
    return true;
  }
  up(event: PointerInput): boolean {
    if (event.pointerId !== this.pointerId || event.button !== 0) return false;
    this.append(event);
    const { scene } = this.options;
    const stroke = scene.active;
    scene.active = null;
    if (stroke) this.options.onCommit(stroke);
    return true;
  }
  cancel(pointerId?: number): boolean {
    if (
      this.pointerId === null ||
      (pointerId !== undefined && pointerId !== this.pointerId)
    )
      return false;
    this.options.scene.active = null;
    this.options.onActiveChange();
    return true;
  }
  private append(event: PointerInput): boolean {
    const stroke = this.options.scene.active;
    if (!stroke) return false;
    const bounds = this.options.bounds();
    const previous = stroke.points.at(-1) ?? null;
    const points: Point[] = [];
    for (const sample of eventSamples(event)) {
      if (sample.pointerId !== stroke.pointerId) continue;
      const point = BoardCoordinates.toScenePoint(
        sample,
        bounds,
        this.options.viewport(),
      );
      if (!point) continue;
      const last = points.at(-1) ?? previous;
      if (
        last &&
        point.x === last.x &&
        point.y === last.y &&
        point.pressure === last.pressure &&
        point.time === last.time
      )
        continue;
      points.push(point);
    }
    if (!points.length) return false;
    stroke.points.push(...points);
    return true;
  }
}

export const BoardInput = { eventSamples };
