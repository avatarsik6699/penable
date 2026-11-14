import type { PointerInput, Position } from "../board.types";
import { BoardViewport } from "../viewport";
import type { TouchBaseline, TouchOptions } from "./touch.types";

export class BoardTouchGestures {
  private contacts = new Map<number, Position>();
  private baseline: TouchBaseline | null = null;
  private edit: number | null = null;
  private tap: { id: number; origin: Position } | null = null;
  private quarantined = false;

  constructor(private readonly options: TouchOptions) {}

  get busy() {
    return this.contacts.size > 0 && !this.quarantined;
  }

  get pointerIds() {
    return [...this.contacts.keys()];
  }

  has(pointerId: number) {
    return this.contacts.has(pointerId);
  }

  down(event: PointerInput): boolean {
    if (event.pointerType !== "touch") return false;

    if (
      ![event.clientX, event.clientY].every(Number.isFinite) ||
      this.contacts.size >= 16
    )
      return true;

    this.contacts.set(event.pointerId, this.point(event));

    if (
      this.options.blocked() ||
      this.options.occupied(this.edit) ||
      this.contacts.size > 2
    ) {
      this.preempt();

      return true;
    }

    if (this.quarantined) return true;

    if (this.contacts.size === 2) {
      this.cancelEdit();
      this.tap = null;
    } else if (this.options.placement()) {
      this.tap = {
        id: event.pointerId,
        origin: { x: event.clientX, y: event.clientY },
      };
    } else if (this.options.editing() && this.options.beginEdit(event)) {
      this.edit = event.pointerId;
    }

    this.rebase();

    return true;
  }

  move(event: PointerInput): boolean {
    if (!this.has(event.pointerId) || event.pointerType !== "touch")
      return false;

    if (this.options.blocked() || this.options.occupied(this.edit))
      this.preempt();

    if (this.quarantined) return true;

    if (![event.clientX, event.clientY].every(Number.isFinite)) return true;

    this.contacts.set(event.pointerId, this.point(event));

    if (this.edit === event.pointerId) {
      this.options.moveEdit(event);

      return true;
    }

    if (this.tap) {
      if (
        Math.hypot(
          event.clientX - this.tap.origin.x,
          event.clientY - this.tap.origin.y,
        ) <= 8
      )
        return true;

      this.tap = null;
    }

    const baseline = this.baseline;

    if (!baseline) return true;

    const measure = this.measure();

    if (
      this.contacts.size === 2 &&
      baseline.distance < 1 &&
      measure.distance >= 1
    ) {
      this.rebase();

      return true;
    }

    const zoom = Math.max(
      BoardViewport.MIN_ZOOM,
      Math.min(
        BoardViewport.MAX_ZOOM,
        baseline.viewport.zoom *
          (baseline.distance > 0 ? measure.distance / baseline.distance : 1),
      ),
    );

    const world = BoardViewport.screenToWorld(
      baseline.center,
      baseline.viewport,
    );

    const next = {
      zoom,
      x: measure.center.x - world.x * zoom,
      y: measure.center.y - world.y * zoom,
    };

    if ([next.zoom, next.x, next.y].every(Number.isFinite))
      this.options.navigate(next);

    return true;
  }

  up(event: PointerInput): boolean {
    if (!this.has(event.pointerId) || event.pointerType !== "touch")
      return false;

    if (this.options.blocked() || this.options.occupied(this.edit))
      this.preempt();

    if (!this.quarantined) {
      if (this.edit === event.pointerId) {
        this.edit = null;
        this.options.endEdit(event);
      } else if (
        this.tap?.id === event.pointerId &&
        Math.hypot(
          event.clientX - this.tap.origin.x,
          event.clientY - this.tap.origin.y,
        ) <= 8
      ) {
        this.options.place(event);
      }
    }

    this.contacts.delete(event.pointerId);
    this.tap = null;

    if (!this.contacts.size) {
      this.quarantined = false;
      this.baseline = null;
    } else if (!this.quarantined) this.rebase();

    return true;
  }

  preempt() {
    this.cancelEdit();
    this.tap = null;
    this.baseline = null;
    this.quarantined = this.contacts.size > 0;
  }

  cancel(pointerId?: number) {
    if (pointerId !== undefined && !this.has(pointerId)) return false;

    const hadContacts = this.contacts.size > 0;

    this.preempt();

    if (pointerId === undefined) this.contacts.clear();
    else this.contacts.delete(pointerId);

    if (!this.contacts.size) this.quarantined = false;

    return hadContacts;
  }

  private cancelEdit() {
    if (this.edit === null) return;

    this.edit = null;
    this.options.cancelEdit();
  }

  private point(event: PointerInput): Position {
    const origin = this.options.origin?.() ?? { x: 0, y: 0 };

    return { x: event.clientX - origin.x, y: event.clientY - origin.y };
  }

  private measure() {
    const points = [...this.contacts.values()];

    const a = points[0] ?? { x: 0, y: 0 },
      b = points[1];

    return b
      ? {
          center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
          distance: Math.hypot(b.x - a.x, b.y - a.y),
        }
      : { center: a, distance: 0 };
  }

  private rebase() {
    this.baseline = {
      ...this.measure(),
      viewport: { ...this.options.viewport() },
    };
  }
}
