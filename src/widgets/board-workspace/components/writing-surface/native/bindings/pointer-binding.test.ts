import { describe, expect, it, vi } from "vitest";
import { PointerBinding } from "./pointer-binding";
import type { CursorBinding } from "./cursor-binding";
import type { EdgePan } from "./edge-pan";
import type { TouchBinding } from "./touch-binding";
import type { BindingOptions } from "./surface-bindings.types";

function pointer(
  pointerId: number,
  pointerType: string,
  buttons: number,
  clientX: number,
): PointerEvent {
  return {
    pointerId,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons,
    clientX,
    clientY: 30,
    target: null,
    preventDefault: vi.fn(),
  } as unknown as PointerEvent;
}

function harness() {
  let owner: number | null = null;

  const input = {
    get pointerId() {
      return owner;
    },
    down: vi.fn((event: PointerEvent) => {
      owner = event.pointerId;

      return true;
    }),
    move: vi.fn((event: PointerEvent) => {
      if (event.pointerId === owner && (event.buttons & 1) === 0) owner = null;

      return true;
    }),
    up: vi.fn((event: PointerEvent) => {
      if (event.pointerId === owner) owner = null;

      return true;
    }),
    cancel: vi.fn(() => {
      owner = null;
    }),
  };

  const navigation = {
    pointerId: null,
    startPan: vi.fn(() => false),
    movePan: vi.fn(() => false),
    endPan: vi.fn(() => false),
    suspendWheel: vi.fn(),
  };

  const canvas = {
    focus: vi.fn(),
    setPointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
  };

  const options = {
    canvas,
    navigation,
    input,
    eraser: { pointerId: null, cancel: vi.fn() },
    selection: {
      pointerId: null,
      finishNudge: vi.fn(),
      down: vi.fn(() => false),
      cancel: vi.fn(),
    },
    getTool: () => "pen",
    canWrite: () => true,
    interactionsBlocked: () => false,
    drawingPointerId: () => owner,
    activeInput: () => input,
    observeInput: vi.fn(),
    publishHistoryState: vi.fn(),
  } as unknown as BindingOptions;

  const sample = vi.fn<(event: PointerEvent) => void>();

  const cursor = {
    model: {
      begin: vi.fn(),
      end: vi.fn(),
      cancel: vi.fn(),
    },
    sample,
    update: vi.fn(),
    blurCanvas: vi.fn(),
  } as unknown as ReturnType<typeof CursorBinding.create>;

  const touch = {
    busy: false,
    down: vi.fn(),
    move: vi.fn(),
    up: vi.fn(),
    cancel: vi.fn(),
    preempt: vi.fn(),
    has: vi.fn(() => false),
  } as unknown as ReturnType<typeof TouchBinding.create>;

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

  return { binding, cursor, input, sample };
}

describe("pen cursor release presentation", () => {
  it("keeps the accepted pen position at up while passing the original up event to ink", () => {
    const h = harness();
    const down = pointer(7, "pen", 1, 12);
    const acceptedMove = pointer(7, "pen", 1, 18);
    const terminalUp = pointer(7, "pen", 0, 900);

    h.binding.down(down);
    h.binding.move(acceptedMove);
    h.binding.up(terminalUp);

    expect(h.sample.mock.calls.map(([event]) => event)).toEqual([
      down,
      acceptedMove,
    ]);

    expect(h.input.up).toHaveBeenCalledWith(terminalUp);
    expect(h.cursor.model.end).toHaveBeenCalledWith(7);
    expect(h.cursor.update).toHaveBeenCalled();
  });

  it("skips an owned pen buttons-loss sample but keeps cancellation and accepts later hover", () => {
    const h = harness();
    const down = pointer(7, "pen", 1, 12);
    const releaseBoundary = pointer(7, "pen", 0, 900);
    const hover = pointer(7, "pen", 0, 22);

    h.binding.down(down);
    h.binding.move(releaseBoundary);

    expect(h.sample.mock.calls.map(([event]) => event)).toEqual([down]);
    expect(h.input.move).toHaveBeenCalledWith(releaseBoundary);
    expect(h.cursor.model.end).toHaveBeenCalledWith(7);

    h.binding.move(hover);

    expect(h.sample.mock.calls.map(([event]) => event)).toEqual([down, hover]);
  });

  it("preserves sampling for foreign buttons-loss pointers and mouse release", () => {
    const h = harness();
    const down = pointer(7, "pen", 1, 12);
    const foreign = pointer(8, "pen", 0, 40);
    const mouseUp = pointer(9, "mouse", 0, 55);

    h.binding.down(down);
    h.binding.move(foreign);
    h.binding.up(mouseUp);

    expect(h.sample.mock.calls.map(([event]) => event)).toEqual([
      down,
      foreign,
      mouseUp,
    ]);

    expect(h.input.move).toHaveBeenCalledWith(foreign);
    expect(h.input.up).toHaveBeenCalledWith(mouseUp);
  });
});
