import { Messages } from "~/shared/lib/messages";
import { describe, expect, it } from "vitest";
import type {
  PointerInput,
  SelectionShape,
  Viewport,
} from "../../../board.types";
import { SelectionGesture } from "./selection-gesture";

function pointer(
  x: number,
  y = 0,
  overrides: Partial<PointerInput> = {},
): PointerInput {
  return {
    pointerId: 1,
    pointerType: "pen",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    pressure: 0.5,
    timeStamp: 1,
    ...overrides,
  };
}

function harness(hit = false) {
  let shape: SelectionShape = "rectangle",
    viewport: Viewport = { x: 3, y: 4, zoom: 2 };

  const gesture = new SelectionGesture({
    world: (event) => ({ x: event.clientX, y: event.clientY }),
    viewport: () => viewport,
    writable: () => true,
    hit: () => hit,
    shape: () => shape,
  });

  return {
    gesture,

    shape: (next: SelectionShape) => {
      shape = next;
    },

    viewport: (next: Viewport) => {
      viewport = next;
    },
  };
}

describe("selection contact owner", () => {
  it("guards pointer ownership and reports cancellation without losing the starting drag viewport", () => {
    const h = harness(true);

    expect(h.gesture.down(pointer(1))).toBe(true);
    expect(h.gesture.down(pointer(2, 2, { pointerId: 2 }))).toBe(false);

    expect(h.gesture.move(pointer(4, 5, { pointerId: 2 }))).toEqual({
      kind: "ignored",
    });

    h.viewport({ x: 40, y: 50, zoom: 2 });

    expect(h.gesture.move(pointer(6, 7))).toEqual({
      kind: "drag",
      delta: { x: 5, y: 7 },
    });

    expect(h.gesture.move(pointer(6, 7, { buttons: 0 }))).toEqual({
      kind: "cancel",
    });

    expect(h.gesture.cancel()).toEqual({ x: 3, y: 4, zoom: 2 });
    expect(h.gesture.pointerId).toBeNull();
    expect(h.gesture.moving).toBe(false);
    expect(h.gesture.release()).toEqual({ kind: "none" });
  });

  it("consults the current shape for sampling, draft outline and released region", () => {
    const h = harness();

    h.gesture.down(pointer(0));
    h.gesture.move(pointer(3, 2));

    expect(h.gesture.draftOutline).toEqual([
      [
        [
          [0, 0],
          [3, 0],
          [3, 2],
          [0, 2],
          [0, 0],
        ],
      ],
    ]);

    h.shape("lasso");
    expect(h.gesture.draftOutline).toEqual([]);
    h.gesture.move(pointer(4, 2));
    h.gesture.move(pointer(4, 5));

    expect(h.gesture.draftOutline).toEqual([
      [
        [
          [0, 0],
          [4, 2],
          [4, 5],
          [0, 0],
        ],
      ],
    ]);

    expect(h.gesture.release()).toEqual({
      kind: "region",
      input: {
        shape: "lasso",
        points: [
          { x: 0, y: 0 },
          { x: 4, y: 2 },
          { x: 4, y: 5 },
        ],
      },
    });

    expect(h.gesture.draftOutline).toBeNull();
    expect(h.gesture.pointerId).toBeNull();
  });

  it("rejects invalid down samples and ignores nonfinite moves without replacing the last position", () => {
    const h = harness();

    expect(h.gesture.down(pointer(NaN))).toBe(false);
    expect(h.gesture.down(pointer(0, 0, { pointerType: "touch" }))).toBe(false);
    expect(h.gesture.down(pointer(0))).toBe(true);
    expect(h.gesture.move(pointer(2, 3))).toEqual({ kind: "draft" });
    expect(h.gesture.move(pointer(Infinity))).toEqual({ kind: "handled" });

    expect(h.gesture.release()).toEqual({
      kind: "region",
      input: {
        shape: "rectangle",
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 3 },
        ],
      },
    });
  });

  it("bounds raw lasso sampling and leaves cancellation/feedback coordination to the caller", () => {
    const h = harness();

    h.shape("lasso");
    h.gesture.down(pointer(0));

    for (let index = 1; index < 2048; index++)
      expect(h.gesture.move(pointer(index))).toEqual({ kind: "draft" });

    const limited = h.gesture.move(pointer(2048));

    expect(limited.kind).toBe("error");

    if (limited.kind !== "error")
      throw new Error("Expected a bounded-lasso error");

    expect(limited.error).toBeInstanceOf(Error);

    expect(limited.error.message).toBe(
      "Лассо: предел 2048 вершин. Попробуйте более короткую границу.",
    );

    expect(Messages.from(limited.error)).toEqual({
      code: "lassoLimit2048VerticesTryAShorter",
    });

    expect(h.gesture.pointerId).toBe(1);
    expect(h.gesture.cancel()).toBeNull();
    expect(h.gesture.pointerId).toBeNull();
  });
});
