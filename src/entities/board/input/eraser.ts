import { type Stroke, type Position, type PointerInput } from "../board.types";
import { StrokeHitTester } from "./hit-test";
import { BoardCoordinates } from "../viewport";
import { BoardInput } from "./input";
import { type EraserOptions } from "./eraser.types";

export class EraserInput {
  readonly preview = new Set<Stroke>();
  private owner: number | null = null;
  private previous: Position | null = null;
  private tester: StrokeHitTester | null = null;

  constructor(private readonly options: EraserOptions) {}

  get pointerId(): number | null {
    return this.owner;
  }

  down(event: PointerInput): boolean {
    if (
      this.owner !== null ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.buttons !== 1 ||
      (event.pointerType !== "pen" && event.pointerType !== "mouse")
    )
      return false;

    if (
      !BoardCoordinates.toScenePoint(
        event,
        this.options.bounds(),
        this.options.viewport(),
      )
    )
      return false;

    this.owner = event.pointerId;
    this.tester = new StrokeHitTester(this.options.viewport().zoom);
    this.append(event);

    return true;
  }

  move(event: PointerInput): boolean {
    if (this.owner === null || event.pointerId !== this.owner) return false;

    if (event.buttons !== 1) {
      this.cancel(event.pointerId);

      return false;
    }

    this.append(event);

    return true;
  }

  up(event: PointerInput): boolean {
    if (
      this.owner === null ||
      event.pointerId !== this.owner ||
      event.button !== 0
    )
      return false;

    this.append(event);

    const erased = new Set(this.preview);

    this.reset();

    if (erased.size) this.options.onCommit(erased);

    this.options.onPreviewChange();

    return true;
  }

  cancel(pointerId?: number): boolean {
    if (
      this.owner === null ||
      (pointerId !== undefined && pointerId !== this.owner)
    )
      return false;

    this.reset();
    this.options.onPreviewChange();

    return true;
  }

  private reset() {
    this.owner = null;
    this.previous = null;
    this.tester = null;
    this.preview.clear();
  }

  private append(event: PointerInput) {
    const bounds = this.options.bounds();
    const viewport = this.options.viewport();
    const samples = BoardInput.eventSamples(event);
    // Release coordinates can extend beyond the last coalesced sample.
    const last = samples.at(-1);

    if (
      last &&
      (last.clientX !== event.clientX || last.clientY !== event.clientY)
    )
      samples.push(event);

    let changed = false;

    for (const sample of samples) {
      if (sample.pointerId !== this.owner) continue;

      const point = BoardCoordinates.toScenePoint(sample, bounds, viewport);

      if (!point) continue;

      const previous = this.previous ?? point;

      for (const stroke of this.options.scene.strokes) {
        if (stroke.kind === "image" || stroke.kind === "template") continue;

        if (
          !this.preview.has(stroke) &&
          this.tester?.hits(stroke, previous, point)
        ) {
          this.preview.add(stroke);
          changed = true;
        }
      }

      this.previous = point;
    }

    if (changed) this.options.onPreviewChange();
  }
}
