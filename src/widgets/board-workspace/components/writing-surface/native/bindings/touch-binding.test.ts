import { describe, expect, it, vi } from "vitest";
import { BoardNavigation, PenInput, type Scene } from "~/entities/board";
import { PointerBinding } from "./pointer-binding";
import { TouchBinding } from "./touch-binding";
import type { BindingOptions } from "./surface-bindings.types";
import type { CursorBinding } from "./cursor-binding";
import type { EdgePan } from "./edge-pan";

function pointer(id: number, x: number, type = "touch"): PointerEvent {
  return {
    pointerId: id,
    pointerType: type,
    isPrimary: id !== 2,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: 300,
    pressure: 0.5,
    timeStamp: x,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

function harness(fingerInput = false, writable = true) {
  const scene: Scene = { strokes: [], active: null };

  const canvas = {
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 1000,
      height: 800,
    }),
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    hasPointerCapture: () => false,
  };

  const input: PenInput = new PenInput({
    scene,
    allowTouch: () => fingerInput,
    bounds: () => ({ left: 0, top: 0 }),
    viewport: () => navigation.viewport,
    width: () => 3,
    onActiveChange: vi.fn(),
    onCommit: (stroke) => scene.strokes.push(stroke),
  });

  let touch: ReturnType<typeof TouchBinding.create>;

  const navigation: BoardNavigation = new BoardNavigation({
    viewport: { x: 0, y: 0, zoom: 1 },
    clock: () => 0,
    isDrawing: () => input.pointerId !== null || Boolean(touch?.busy),
    onChange: vi.fn(),
  });

  const options = {
    canvas,
    input,
    navigation,
    eraser: { pointerId: null, cancel: vi.fn() },
    selection: {
      pointerId: null,
      busy: false,
      cancel: vi.fn(),
      finishNudge: vi.fn(),
    },
    canWrite: () => writable,
    interactionsBlocked: () => false,
    drawingPointerId: () => input.pointerId,
    activeInput: () => input,
    getFingerInput: () => fingerInput,
    getTool: () => "pen",
    observeInput: vi.fn(),
    publishHistoryState: vi.fn(),
  } as unknown as BindingOptions;

  touch = TouchBinding.create(options);

  const cursor = {
    model: { cancel: vi.fn(), begin: vi.fn(), end: vi.fn() },
    sample: vi.fn(),
    update: vi.fn(),
    blurCanvas: vi.fn(),
  } as unknown as ReturnType<typeof CursorBinding.create>;

  const edge = { start: vi.fn() } as unknown as ReturnType<
    typeof EdgePan.create
  >;

  const binding = PointerBinding.create(
    options,
    { spaceDown: false, focused: true, keyboardEntry: false },
    cursor,
    edge,
    touch,
  );

  return { binding, touch, input, navigation, scene, canvas };
}

describe("native pen and touch arbitration", () => {
  it("quarantines touch contacts until release while a mouse pan owns the camera", () => {
    const h = harness();
    const mouse = pointer(99, 100, "mouse");

    expect(h.navigation.startPan(mouse, true)).toBe(true);
    h.binding.down(pointer(1, 200));
    h.binding.move(pointer(1, 300));
    expect(h.navigation.viewport.x).toBe(0);
    expect(h.navigation.pointerId).toBe(99);
    h.binding.move(pointer(99, 130, "mouse"));
    expect(h.navigation.viewport.x).toBe(30);
    h.binding.up(pointer(99, 130, "mouse"));
    h.binding.move(pointer(1, 400));
    expect(h.navigation.viewport.x).toBe(30);
    h.binding.up(pointer(1, 400));
    h.binding.down(pointer(1, 100));
    h.binding.move(pointer(1, 120));
    expect(h.navigation.viewport.x).toBe(50);
  });

  it("preempts finger navigation with pen and never lets held touches move or cancel its stroke", () => {
    const h = harness();

    h.binding.down(pointer(1, 100));
    h.binding.move(pointer(1, 150));
    expect(h.navigation.viewport.x).toBe(50);
    h.binding.down(pointer(99, 200, "pen"));
    expect(h.input.pointerId).toBe(99);

    const camera = h.navigation.viewport;

    h.binding.move(pointer(1, 400));
    expect(h.input.pointerId).toBe(99);
    expect(h.navigation.viewport).toEqual(camera);
    h.binding.move(pointer(99, 240, "pen"));
    h.binding.up(pointer(99, 250, "pen"));
    expect(h.scene.strokes).toHaveLength(1);
    h.binding.move(pointer(1, 500));
    expect(h.navigation.viewport).toEqual(camera);
    h.binding.up(pointer(1, 500));
    h.binding.down(pointer(1, 100));
    h.binding.move(pointer(1, 120));
    expect(h.navigation.viewport.x).toBe(camera.x + 20);
  });

  it("cancels finger ink before pinch and clears the native contacts after capture loss", () => {
    const h = harness(true);

    h.binding.down(pointer(1, 100));
    expect(h.scene.active).not.toBeNull();
    h.binding.down(pointer(2, 200));
    expect(h.scene.active).toBeNull();
    expect(h.scene.strokes).toHaveLength(0);
    h.binding.move(pointer(2, 300));
    expect(h.navigation.viewport.zoom).toBe(2);
    h.binding.lostCapture(pointer(2, 300));

    const camera = h.navigation.viewport;

    h.binding.move(pointer(1, 300));
    expect(h.navigation.viewport).toEqual(camera);
    h.binding.cancel();
    expect(h.touch.busy).toBe(false);
  });

  it("permits readonly finger navigation while never starting the selected ink tool", () => {
    const h = harness(true, false);

    h.binding.down(pointer(1, 100));
    h.binding.move(pointer(1, 160));
    h.binding.up(pointer(1, 160));
    expect(h.navigation.viewport.x).toBe(60);
    expect(h.scene.active).toBeNull();
    expect(h.scene.strokes).toHaveLength(0);
  });
});
