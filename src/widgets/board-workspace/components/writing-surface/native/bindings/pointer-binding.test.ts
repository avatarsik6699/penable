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
  const guards = { writable: true, blocked: false };
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
    canWrite: () => guards.writable,
    interactionsBlocked: () => guards.blocked,
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

  const interaction = { spaceDown: false, focused: true, keyboardEntry: false };

  const binding = PointerBinding.create(
    options,
    interaction,
    cursor,
    edge,
    touch,
  );

  return {
    binding,
    cursor,
    input,
    sample,
    canvas,
    options,
    interaction,
    guards,
  };
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

describe("fresh pen contact transitions", () => {
  it("starts a new pen contact reported as a move after focus cancellation", () => {
    const h = harness();

    h.binding.down(pointer(7, "pen", 1, 12));
    h.binding.cancel();

    const held = {
      ...pointer(7, "pen", 1, 18),
      button: -1,
      target: h.canvas,
    } as unknown as PointerEvent;

    h.binding.move(held);
    expect(h.input.down).toHaveBeenCalledTimes(1);

    const contact = {
      ...pointer(7, "pen", 1, 24),
      target: h.canvas,
    } as unknown as PointerEvent;

    h.binding.move(contact);
    expect(h.input.down).toHaveBeenCalledTimes(2);
    expect(h.input.down).toHaveBeenLastCalledWith(contact);
  });

  it.each([
    { pointerType: "mouse" },
    { pointerType: "touch" },
    { button: -1 },
    { button: 2, buttons: 2 },
    { buttons: 0 },
    { buttons: 3 },
    { isPrimary: false },
  ])("does not recover unsupported move %j", (overrides) => {
    const h = harness();

    h.binding.move({
      ...pointer(7, "pen", 1, 12),
      target: h.canvas,
      ...overrides,
    } as unknown as PointerEvent);

    expect(h.input.down).not.toHaveBeenCalled();
  });

  it("does not replace an active pointer with another contact transition", () => {
    const h = harness();

    h.binding.down(pointer(7, "pen", 1, 12));

    h.binding.move({
      ...pointer(8, "pen", 1, 24),
      target: h.canvas,
    } as unknown as PointerEvent);

    expect(h.input.down).toHaveBeenCalledTimes(1);
  });
});

it.each([
  "outside",
  "blur",
  "space",
  "pan",
  "readonly",
  "blocked",
  "placement",
])("does not recover a pen transition while %s", (guard) => {
  const h = harness();

  if (guard === "blur") h.interaction.focused = false;

  if (guard === "space") h.interaction.spaceDown = true;

  if (guard === "pan")
    Object.defineProperty(h.options.navigation, "pointerId", { value: 9 });

  if (guard === "readonly") h.guards.writable = false;

  if (guard === "blocked") h.guards.blocked = true;

  if (guard === "placement")
    h.options.templatePlacement = {
      active: true,
      move: vi.fn(),
    } as unknown as BindingOptions["templatePlacement"];

  h.binding.move({
    ...pointer(7, "pen", 1, 12),
    target: guard === "outside" ? null : h.canvas,
  } as unknown as PointerEvent);

  expect(h.input.down).not.toHaveBeenCalled();
});
