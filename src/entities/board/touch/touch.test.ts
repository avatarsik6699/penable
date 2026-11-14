import { describe, expect, it, vi } from "vitest";
import type { PointerInput, Viewport } from "../board.types";
import { BoardTouchGestures } from "./touch";

function event(
  id: number,
  x: number,
  y = 100,
  patch: Partial<PointerInput> = {},
): PointerInput {
  return {
    pointerId: id,
    pointerType: "touch",
    isPrimary: id === 1,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    pressure: 0.5,
    timeStamp: 1,
    ...patch,
  };
}

function harness() {
  let viewport: Viewport = { x: 0, y: 0, zoom: 1 },
    editing = false,
    blocked = false,
    owner: number | null = null,
    placement = false;

  const cancelEdit = vi.fn(() => {
    owner = null;
  });

  const endEdit = vi.fn(() => {
    owner = null;
  });

  const moveEdit = vi.fn();
  const place = vi.fn();

  const navigate = vi.fn((value: Viewport) => {
    viewport = value;
  });

  const beginEdit = vi.fn((value: PointerInput) => {
    owner = value.pointerId;

    return true;
  });

  const touch = new BoardTouchGestures({
    viewport: () => viewport,
    navigate,
    editing: () => editing,
    blocked: () => blocked,
    occupied: (own) => owner !== null && owner !== own,
    beginEdit,
    moveEdit,
    endEdit,
    cancelEdit,
    placement: () => placement,
    place,
  });

  return {
    touch,
    navigate,
    beginEdit,
    moveEdit,
    endEdit,
    cancelEdit,
    place,
    view: () => viewport,

    editing: (value: boolean) => {
      editing = value;
    },

    blocked: (value: boolean) => {
      blocked = value;
    },

    owner: (value: number | null) => {
      owner = value;
    },

    placement: () => {
      placement = true;
    },
  };
}

describe("touch camera and editing ownership", () => {
  it("pans with one finger without starting ink and ignores pointers that did not begin here", () => {
    const h = harness();

    expect(h.touch.move(event(9, 400))).toBe(false);
    expect(h.touch.down(event(1, 100))).toBe(true);
    h.touch.move(event(1, 150, 130));
    expect(h.view()).toEqual({ x: 50, y: 30, zoom: 1 });
    expect(h.beginEdit).not.toHaveBeenCalled();
    h.touch.up(event(1, 150, 130));
    expect(h.touch.busy).toBe(false);
  });

  it("anchors pinch at the midpoint and rebases without a jump after either finger lifts", () => {
    const h = harness();

    h.touch.down(event(1, 100));
    h.touch.down(event(2, 200));
    h.touch.move(event(2, 300));
    expect(h.view()).toEqual({ zoom: 2, x: -100, y: -100 });
    h.touch.up(event(1, 100));

    const before = h.view();

    h.touch.move(event(2, 300));
    expect(h.view()).toEqual(before);
    h.touch.move(event(2, 310, 120));
    expect(h.view()).toEqual({ zoom: 2, x: -90, y: -80 });
  });

  it("clamps zoom, handles coincident contacts and never emits nonfinite camera values", () => {
    const h = harness();

    h.touch.down(event(1, 100));
    h.touch.down(event(2, 100));
    h.touch.move(event(2, 200));
    h.touch.move(event(2, 100000));
    expect(h.view().zoom).toBe(8);
    h.touch.move(event(2, Infinity));
    expect(Object.values(h.view()).every(Number.isFinite)).toBe(true);
    h.touch.move(event(2, 100.00001));
    expect(h.view().zoom).toBe(0.25);
  });

  it("cancels an uncommitted finger edit before converting the pair to navigation", () => {
    const h = harness();

    h.editing(true);
    h.touch.down(event(1, 100));
    h.touch.move(event(1, 110));
    expect(h.moveEdit).toHaveBeenCalledOnce();
    h.touch.down(event(2, 200));
    expect(h.cancelEdit).toHaveBeenCalledOnce();
    h.touch.move(event(2, 300));
    expect(h.navigate).toHaveBeenCalled();
    h.touch.up(event(1, 110));
    h.touch.up(event(2, 300));
    expect(h.endEdit).not.toHaveBeenCalled();
  });

  it("commits only the owning permitted finger edit", () => {
    const h = harness();

    h.editing(true);
    h.touch.down(event(1, 100));
    h.touch.up(event(8, 120));
    expect(h.endEdit).not.toHaveBeenCalled();
    h.touch.up(event(1, 120));
    expect(h.endEdit).toHaveBeenCalledOnce();
  });

  it("pen preemption keeps held touches quarantined until every contact lifts", () => {
    const h = harness();

    h.editing(true);
    h.touch.down(event(1, 100));
    h.touch.preempt();
    h.owner(99);
    h.touch.down(event(2, 200));
    h.touch.move(event(1, 500));
    h.owner(null);
    h.touch.up(event(1, 500));
    h.touch.move(event(2, 900));
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.beginEdit).toHaveBeenCalledOnce();
    h.touch.up(event(2, 900));
    h.touch.down(event(1, 100));
    expect(h.beginEdit).toHaveBeenCalledTimes(2);
  });

  it("ignores palm contacts during an external pen and does not cancel that owner", () => {
    const h = harness();

    h.owner(99);
    h.touch.down(event(1, 100));
    h.touch.down(event(2, 200));
    h.touch.move(event(1, 300));
    h.touch.up(event(1, 300));
    expect(h.cancelEdit).not.toHaveBeenCalled();
    expect(h.navigate).not.toHaveBeenCalled();
    expect(h.beginEdit).not.toHaveBeenCalled();
  });

  it("quarantines a third contact and cancels safely on capture loss or global reset", () => {
    const h = harness();

    h.touch.down(event(1, 100));
    h.touch.down(event(2, 200));
    h.touch.down(event(3, 300));
    h.touch.move(event(1, 400));
    expect(h.navigate).not.toHaveBeenCalled();
    h.touch.cancel(3);
    h.touch.up(event(1, 400));
    h.touch.move(event(2, 250));
    expect(h.navigate).not.toHaveBeenCalled();
    h.touch.cancel();
    expect(h.touch.pointerIds).toEqual([]);
    expect(h.touch.busy).toBe(false);
  });

  it("places an armed template on a short tap, never on a drag or pinch", () => {
    const h = harness();

    h.placement();
    h.touch.down(event(1, 100));
    h.touch.up(event(1, 105));
    expect(h.place).toHaveBeenCalledOnce();
    h.touch.down(event(1, 100));
    h.touch.move(event(1, 120));
    h.touch.up(event(1, 120));
    h.touch.down(event(1, 100));
    h.touch.down(event(2, 200));
    h.touch.up(event(1, 100));
    h.touch.up(event(2, 200));
    expect(h.place).toHaveBeenCalledOnce();
  });

  it("blocks new gestures and cancels transient edits when the interaction becomes blocked", () => {
    const h = harness();

    h.editing(true);
    h.touch.down(event(1, 100));
    h.blocked(true);
    h.touch.move(event(1, 200));
    expect(h.cancelEdit).toHaveBeenCalledOnce();
    h.touch.up(event(1, 200));
    expect(h.endEdit).not.toHaveBeenCalled();
    h.touch.down(event(1, 100));
    expect(h.touch.busy).toBe(false);
  });
});
