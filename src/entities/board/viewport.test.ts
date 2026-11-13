import { describe, expect, it, vi } from "vitest";
import { BoardNavigation, BoardViewport } from "./viewport";
import type { BoardWheel } from "./viewport";
import type { PointerInput } from "./types";

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return {
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 30,
    clientY: 40,
    pressure: 0.5,
    timeStamp: 1,
    ...overrides,
  };
}

function wheel(overrides: Partial<BoardWheel> = {}): BoardWheel {
  return {
    deltaX: 0,
    deltaY: -100,
    deltaMode: 0,
    ctrlKey: false,
    shiftKey: false,
    anchor: { x: 100, y: 100 },
    width: 600,
    height: 800,
    ...overrides,
  };
}

describe("world / CSS viewport", () => {
  it.each([0.25, 1, 2, 4, 8])(
    "round-trips through zoom %s with translated origin",
    (zoom) => {
      const point = { x: -123.456, y: 987.654 };
      const viewport = { zoom, x: -75.25, y: 203.75 };

      const result = BoardViewport.screenToWorld(
        BoardViewport.worldToScreen(point, viewport),
        viewport,
      );

      expect(result.x).toBeCloseTo(point.x, 6);
      expect(result.y).toBeCloseTo(point.y, 6);
    },
  );

  it("keeps the same world point beneath an arbitrary zoom anchor", () => {
    const viewport = { zoom: 1.2, x: 50, y: -17 };
    const anchor = { x: 328.25, y: 70.75 };
    const world = BoardViewport.screenToWorld(anchor, viewport);
    const next = BoardViewport.zoomAt(viewport, 4, anchor);

    expect(BoardViewport.worldToScreen(world, next).x).toBeCloseTo(anchor.x, 6);
    expect(BoardViewport.worldToScreen(world, next).y).toBeCloseTo(anchor.y, 6);
    expect(viewport).toEqual({ zoom: 1.2, x: 50, y: -17 });
  });

  it("clamps zoom while preserving the anchor and ignores invalid requests", () => {
    const anchor = { x: 100, y: 60 };

    const high = BoardViewport.zoomAt(
      BoardViewport.initialViewport(),
      1000,
      anchor,
    );

    expect(high.zoom).toBe(8);
    expect(BoardViewport.worldToScreen(anchor, high)).toEqual(anchor);

    expect(
      BoardViewport.zoomAt(BoardViewport.initialViewport(), 0.01, anchor).zoom,
    ).toBe(0.25);

    expect(BoardViewport.zoomAt(high, NaN, anchor)).toBe(high);
  });
});

describe("navigation policy", () => {
  it("ignores wheel, buttons, reset and pan during ink without changing the scene viewport", () => {
    const onChange = vi.fn();
    const viewport = { zoom: 2, x: 5, y: 10 };

    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport,
      isDrawing: () => true,
      onChange,
    });

    expect(navigation.wheel(wheel())).toBe(false);
    expect(navigation.setZoom(4, { x: 0, y: 0 })).toBe(false);
    expect(navigation.reset()).toBe(false);
    expect(navigation.startPan(pointer(), true)).toBe(false);

    expect(navigation.startPan(pointer({ button: 1, buttons: 4 }), false)).toBe(
      false,
    );

    expect(navigation.viewport).toBe(viewport);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("pans in CSS pixels with space-primary or middle, never normal/right/touch contact", () => {
    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: { zoom: 4, x: 5, y: 10 },
      isDrawing: () => false,
      onChange: vi.fn(),
    });

    expect(navigation.startPan(pointer(), false)).toBe(false);

    expect(navigation.startPan(pointer({ button: 2, buttons: 2 }), true)).toBe(
      false,
    );

    expect(navigation.startPan(pointer({ pointerType: "touch" }), true)).toBe(
      false,
    );

    expect(navigation.startPan(pointer(), true)).toBe(true);

    expect(navigation.movePan(pointer({ pointerId: 2, clientX: 80 }))).toBe(
      false,
    );

    navigation.movePan(pointer({ clientX: 80, clientY: 20 }));
    expect(navigation.viewport).toEqual({ zoom: 4, x: 55, y: -10 });
    expect(navigation.endPan(2)).toBe(false);
    expect(navigation.endPan(1)).toBe(true);

    expect(navigation.startPan(pointer({ button: 1, buttons: 4 }), false)).toBe(
      true,
    );

    navigation.movePan(pointer({ button: -1, buttons: 0 }));
    expect(navigation.pointerId).toBeNull();
  });

  it("resets both scale and pan, and normalizes line/page wheel units", () => {
    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      onChange: vi.fn(),
    });

    navigation.wheel(wheel({ deltaY: -10, deltaMode: 1, ctrlKey: true }));
    expect(navigation.viewport.zoom).toBeCloseTo(Math.exp(0.32), 6);
    navigation.wheel(wheel({ deltaY: -1, deltaMode: 2, ctrlKey: true }));
    expect(navigation.viewport.zoom).toBeGreaterThan(1);
    navigation.reset();
    expect(navigation.viewport).toEqual(BoardViewport.initialViewport());
  });
});

describe("two-axis wheel navigation", () => {
  it.each([
    [
      { deltaX: 12, deltaY: -20 },
      { x: -12, y: 20 },
    ],
    [
      { deltaX: 2, deltaY: -3, deltaMode: 1 },
      { x: -32, y: 48 },
    ],
    [
      { deltaX: 1, deltaY: -1, deltaMode: 2 },
      { x: -600, y: 800 },
    ],
    [
      { deltaY: 25, shiftKey: true },
      { x: -25, y: 0 },
    ],
    [
      { deltaX: 10, deltaY: 25, shiftKey: true },
      { x: -10, y: -25 },
    ],
  ])("normalizes axes and modifiers %o", (deltas, offsets) => {
    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      onChange: vi.fn(),
    });

    navigation.wheel(wheel(deltas));
    expect(navigation.viewport).toEqual({ zoom: 1, ...offsets });
  });

  it("anchors Ctrl pinch zoom and clamps it without panning", () => {
    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      onChange: vi.fn(),
    });

    const anchor = { x: 50, y: 70 };

    navigation.wheel(wheel({ deltaY: -5000, ctrlKey: true, anchor }));
    navigation.wheel(wheel({ deltaY: -5000, ctrlKey: true, anchor }));
    expect(navigation.viewport.zoom).toBe(8);

    expect(BoardViewport.worldToScreen(anchor, navigation.viewport)).toEqual(
      anchor,
    );

    expect(
      navigation.wheel(wheel({ deltaY: -100, ctrlKey: true, anchor })),
    ).toBe(false);
  });

  it("rejects malformed input without poisoning the viewport", () => {
    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      onChange: vi.fn(),
    });

    for (const invalid of [
      { deltaX: NaN },
      { deltaY: Infinity },
      { width: 0 },
      { height: NaN },
      { deltaMode: 3 },
      { anchor: { x: NaN, y: 3 } },
    ]) {
      expect(navigation.wheel(wheel(invalid))).toBe(false);
    }

    expect(navigation.viewport).toEqual(BoardViewport.initialViewport());
  });

  it("quarantines wheel during drawing and its continuous inertia until a 150ms gap", () => {
    let now = 0;
    let drawing = true;

    const navigation = new BoardNavigation({
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => drawing,
      clock: () => now,
      onChange: vi.fn(),
    });

    expect(navigation.wheel(wheel())).toBe(false);
    drawing = false;

    for (now = 50; now < 500; now += 50)
      expect(navigation.wheel(wheel())).toBe(false);

    now = 600;
    expect(navigation.wheel(wheel())).toBe(true);
    expect(navigation.viewport.y).toBe(100);
  });

  it("suspends a wheel stream at pointer down even if no wheel arrives during contact", () => {
    let now = 0;

    const navigation = new BoardNavigation({
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      clock: () => now,
      onChange: vi.fn(),
    });

    navigation.wheel(wheel());
    now = 30;
    navigation.suspendWheel();
    now = 80;
    expect(navigation.wheel(wheel())).toBe(false);
    now = 230;
    expect(navigation.wheel(wheel())).toBe(true);
    expect(navigation.viewport.y).toBe(200);
  });

  it("quarantines wheel overlapping pointer pan and lets a fresh stream through", () => {
    let now = 0;

    const navigation = new BoardNavigation({
      viewport: BoardViewport.initialViewport(),
      isDrawing: () => false,
      clock: () => now,
      onChange: vi.fn(),
    });

    navigation.startPan(pointer(), true);
    expect(navigation.wheel(wheel())).toBe(false);
    navigation.endPan();
    now = 100;
    expect(navigation.wheel(wheel())).toBe(false);
    now = 250;
    expect(navigation.wheel(wheel())).toBe(true);
  });
});
