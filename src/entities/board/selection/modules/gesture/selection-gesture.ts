import type { PointerInput, Viewport } from "../../../board.types";
import { BoardRegions } from "../../../regions";
import type {
  GestureContact,
  GestureOptions,
  GestureUpdate,
  GestureRelease,
  GestureOutline,
} from "./selection-gesture.types";

// One contact owns raw lasso samples and capture-time viewport; canonical selection
// membership, previews and async transaction acceptance belong to BoardSelection.
export class SelectionGesture {
  private contact: GestureContact | null = null;

  constructor(private readonly options: GestureOptions) {}

  get pointerId(): number | null {
    return this.contact?.pointerId ?? null;
  }

  get moving(): boolean {
    return Boolean(this.contact?.moving);
  }

  get draftOutline(): GestureOutline {
    const contact = this.contact;

    if (!contact || contact.moving) return null;

    return this.options.shape() === "rectangle"
      ? BoardRegions.rectangle(contact.start, contact.current)
      : contact.points.length < 3
        ? []
        : [
            [
              contact.points
                .concat(contact.points[0]!)
                .map(({ x, y }) => [x, y]),
            ],
          ];
  }

  down(event: PointerInput): boolean {
    if (
      this.contact ||
      !event.isPrimary ||
      event.button !== 0 ||
      event.buttons !== 1 ||
      (!["pen", "mouse"].includes(event.pointerType) &&
        !(event.pointerType === "touch" && this.options.allowTouch?.())) ||
      !Number.isFinite(event.clientX) ||
      !Number.isFinite(event.clientY)
    )
      return false;

    const point = this.options.world(event),
      moving = this.options.writable() && this.options.hit(point);

    this.contact = {
      pointerId: event.pointerId,
      start: point,
      current: point,
      points: [point],
      viewport: { ...this.options.viewport() },
      moving,
    };

    return true;
  }

  move(event: PointerInput): GestureUpdate {
    const contact = this.contact;

    if (!contact || contact.pointerId !== event.pointerId)
      return { kind: "ignored" };

    if (event.buttons !== 1) return { kind: "cancel" };

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
      return { kind: "handled" };

    contact.current = this.options.world(event);

    if (contact.moving)
      return {
        kind: "drag",
        delta: {
          x: contact.current.x - contact.start.x,
          y: contact.current.y - contact.start.y,
        },
      };

    if (this.options.shape() === "lasso") {
      const last = contact.points.at(-1)!;

      if (
        Math.hypot(last.x - contact.current.x, last.y - contact.current.y) *
          this.options.viewport().zoom >=
        2
      ) {
        if (contact.points.length >= BoardRegions.REGION_LIMITS.lasso)
          return {
            kind: "error",
            error: new Error(
              "Лассо: предел 2048 вершин. Попробуйте более короткую границу.",
            ),
          };

        contact.points.push(contact.current);
      }
    }

    return { kind: "draft" };
  }

  release(): GestureRelease {
    const contact = this.contact;

    if (!contact) return { kind: "none" };

    this.contact = null;

    return contact.moving
      ? { kind: "drag", viewport: contact.viewport }
      : {
          kind: "region",
          input: {
            shape: this.options.shape(),
            points:
              this.options.shape() === "rectangle"
                ? [contact.start, contact.current]
                : contact.points,
          },
        };
  }

  cancel(): Viewport | null {
    const contact = this.contact;

    this.contact = null;

    return contact?.moving ? contact.viewport : null;
  }
}
