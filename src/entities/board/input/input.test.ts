import { describe, expect, it, vi } from "vitest";
import { BoardWriting } from "../writing";
import { PenInput, BoardInput } from "./input";
import type { PointerInput, Scene, Stroke, Viewport } from "../board.types";
import { BoardViewport } from "../viewport";
import { StrokeHistory } from "../history";

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return {
    pointerId: 1,
    pointerType: "pen",
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

function setup() {
  const scene: Scene = { strokes: [], active: null };
  const changed = vi.fn();
  const history = new StrokeHistory(scene.strokes);
  const committed = vi.fn((stroke: Stroke) => history.commit(stroke));
  let width = 3;
  let stabilization = 0;
  let viewport = BoardViewport.initialViewport();

  const input = new PenInput({
    scene,
    bounds: () => ({ left: 10, top: 20 }),
    viewport: () => viewport,
    width: () => width,
    stabilization: () => stabilization,
    onActiveChange: changed,
    onCommit: committed,
  });

  return {
    input,
    scene,
    changed,
    committed,

    setWidth: (value: number) => {
      width = value;
    },

    setStabilization: (strength: number) => {
      stabilization = strength;
    },

    setViewport: (value: Viewport) => {
      viewport = value;
    },
  };
}

describe("one-contact pen input", () => {
  it("emits a finished stroke without independently mutating the completed scene", () => {
    const scene: Scene = { strokes: [], active: null };
    const committed = vi.fn();

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      width: () => 3,
      onActiveChange: vi.fn(),
      onCommit: committed,
    });

    input.down(pointer());

    const active = scene.active;

    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 2 }));
    expect(committed).toHaveBeenCalledExactlyOnceWith(active);
    expect(scene.strokes).toEqual([]);
    expect(scene.active).toBeNull();
  });

  it.each([
    { pointerType: "touch" },
    { pointerType: "" },
    { isPrimary: false },
    { button: 2, buttons: 2 },
    { buttons: 0 },
    { button: 5, buttons: 32 },
    { buttons: 3 },
  ])("ignores unsupported contact %j", (overrides) => {
    const { input, scene, changed } = setup();

    expect(input.down(pointer(overrides))).toBe(false);
    expect(scene.active).toBeNull();
    expect(changed).not.toHaveBeenCalled();
  });

  it("ignores hover but accepts primary mouse and pointer id zero", () => {
    const { input, scene } = setup();

    input.move(pointer({ buttons: 0 }));
    expect(scene.active).toBeNull();

    expect(input.down(pointer({ pointerType: "mouse", pointerId: 0 }))).toBe(
      true,
    );

    expect(input.pointerId).toBe(0);
  });

  it("does not allow a second pointer to replace, extend, end or cancel the stroke", () => {
    const { input, scene } = setup();

    input.down(pointer());
    expect(input.down(pointer({ pointerId: 2 }))).toBe(false);
    expect(input.move(pointer({ pointerId: 2, clientX: 70 }))).toBe(false);
    expect(input.up(pointer({ pointerId: 2, buttons: 0 }))).toBe(false);
    expect(input.cancel(2)).toBe(false);
    expect(scene.active?.points).toHaveLength(1);
    expect(input.pointerId).toBe(1);
  });

  it("publishes a tap for rendering and preserves its final sample at zero pressure", () => {
    const { input, scene, changed, committed } = setup();

    input.down(pointer({ pressure: 0 }));
    expect(changed).toHaveBeenCalledTimes(1);
    expect(scene.active?.points).toHaveLength(1);
    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 2 }));
    expect(scene.strokes).toHaveLength(1);

    expect(
      (scene.strokes[0] as import("../board.types").Stroke)?.points,
    ).toEqual([
      { x: 20, y: 20, pressure: 0, time: 1 },
      { x: 20, y: 20, pressure: 0, time: 2 },
    ]);

    expect(input.pointerId).toBeNull();
    expect(committed).toHaveBeenCalledExactlyOnceWith(scene.strokes[0]);
  });

  it("renders moves before completion and includes the final up position", () => {
    const { input, scene, changed } = setup();

    input.down(pointer());
    input.move(pointer({ clientX: 45, timeStamp: 2 }));
    expect(scene.strokes).toHaveLength(0);
    expect(changed).toHaveBeenCalledTimes(2);

    expect(scene.active?.points).toEqual([
      { x: 20, y: 20, pressure: 0.5, time: 1 },
      { x: 35, y: 20, pressure: 0.5, time: 2 },
    ]);

    input.up(
      pointer({
        clientX: 60,
        clientY: 80,
        buttons: 0,
        pressure: 0,
        timeStamp: 3,
      }),
    );

    expect(
      (scene.strokes[0] as import("../board.types").Stroke)?.points.at(-1),
    ).toEqual({
      x: 50,
      y: 60,
      pressure: 0,
      time: 3,
    });
  });

  it("snapshots thickness at stroke start; pressure cannot alter it", () => {
    const { input, scene, setWidth } = setup();

    input.down(pointer());
    setWidth(12);
    input.move(pointer({ pressure: 1, timeStamp: 2 }));
    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 3 }));
    input.down(pointer({ timeStamp: 4 }));

    expect((scene.strokes[0] as import("../board.types").Stroke)?.width).toBe(
      3,
    );

    expect(scene.active?.width).toBe(12);
  });

  it("snapshots numeric strength, fractional width and capture zoom while later settings affect only the next stroke", () => {
    const { input, scene, setWidth, setStabilization, setViewport } = setup();

    setWidth(0.7);
    setStabilization(65);
    setViewport({ zoom: 4, x: 0, y: 0 });
    input.down(pointer());
    setWidth(1.2);
    setStabilization(72);
    input.move(pointer({ clientX: 50, timeStamp: 2 }));

    expect(scene.active?.stabilization).toEqual({
      strength: 65,
      captureZoom: 4,
    });

    expect(scene.active?.width).toBe(0.7);
    input.up(pointer({ clientX: 50, buttons: 0, pressure: 0, timeStamp: 3 }));
    setViewport({ zoom: 2, x: 0, y: 0 });
    input.down(pointer({ timeStamp: 4 }));

    expect(scene.active?.stabilization).toEqual({
      strength: 72,
      captureZoom: 2,
    });

    expect(scene.active?.width).toBe(1.2);

    expect(
      (scene.strokes[0] as import("../board.types").Stroke)?.stabilization,
    ).toEqual({
      strength: 65,
      captureZoom: 4,
    });

    expect((scene.strokes[0] as import("../board.types").Stroke)?.width).toBe(
      0.7,
    );

    expect(
      (scene.strokes[0] as import("../board.types").Stroke)?.points,
    ).toEqual([
      { x: 5, y: 5, pressure: 0.5, time: 1 },
      { x: 10, y: 5, pressure: 0.5, time: 2 },
      { x: 10, y: 5, pressure: 0, time: 3 },
    ]);
  });

  it.each([
    [0.1, 0.5, -10, 0],
    [0.5, 0.5, 0, 0],
    [0.7, 0.7, 65, 65],
    [12.3, 12, 101, 100],
    [NaN, 3, NaN, 0],
    [Infinity, 3, Infinity, 0],
  ])(
    "normalizes width %s/%s and strength %s/%s at capture",
    (requestedWidth, expectedWidth, requestedStrength, expectedStrength) => {
      const { input, scene, setWidth, setStabilization } = setup();

      setWidth(requestedWidth);
      setStabilization(requestedStrength);
      input.down(pointer());
      expect(scene.active?.width).toBe(expectedWidth);

      expect(scene.active?.stabilization).toEqual({
        strength: expectedStrength,
        captureZoom: 1,
      });
    },
  );

  it("discards an interrupted stroke, retains completed strokes and requires a fresh down", () => {
    const { input, scene, changed } = setup();

    input.down(pointer());
    input.up(pointer({ buttons: 0 }));
    input.down(pointer({ timeStamp: 2 }));
    changed.mockClear();
    expect(input.cancel()).toBe(true);
    expect(scene.active).toBeNull();
    expect(scene.strokes).toHaveLength(1);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(input.move(pointer({ timeStamp: 3 }))).toBe(false);
    expect(input.up(pointer({ buttons: 0 }))).toBe(false);
    expect(input.cancel()).toBe(false);
    expect(input.down(pointer())).toBe(true);
    expect(scene.active?.id).not.toBe(scene.strokes[0]?.id);
  });

  it("cancels if contact is lost without up, preventing stuck drawing", () => {
    const { input, scene, changed } = setup();

    input.down(pointer());
    changed.mockClear();
    input.move(pointer({ buttons: 0 }));
    expect(input.pointerId).toBeNull();
    expect(scene.strokes).toHaveLength(0);
    expect(changed).toHaveBeenCalledOnce();
  });

  it("rejects invalid numeric geometry and does not corrupt a valid stroke", () => {
    const { input, scene } = setup();

    expect(input.down(pointer({ clientX: NaN }))).toBe(false);
    input.down(pointer());
    input.move(pointer({ clientX: Infinity }));
    expect(scene.active?.points).toHaveLength(1);
  });
});

describe("coalesced samples", () => {
  it("keeps ordered pressure samples while deduplicating the parent and repeated samples", () => {
    const { input, scene } = setup();

    input.down(pointer());

    const middle = pointer({ clientX: 35, pressure: 0.7, timeStamp: 2 });
    const last = pointer({ clientX: 40, pressure: 0.9, timeStamp: 3 });

    input.move({ ...last, getCoalescedEvents: () => [middle, middle, last] });

    expect(scene.active?.points).toEqual([
      { x: 20, y: 20, pressure: 0.5, time: 1 },
      { x: 25, y: 20, pressure: 0.7, time: 2 },
      { x: 30, y: 20, pressure: 0.9, time: 3 },
    ]);
  });

  it("excludes a distinct aggregate parent so raw samples cannot draw backwards", () => {
    const { input, scene } = setup();

    input.down(pointer({ clientX: 10 }));

    input.move(
      pointer({
        clientX: 25,
        pressure: 0.8,
        timeStamp: 4,
        getCoalescedEvents: () => [
          pointer({ clientX: 20, pressure: 0.6, timeStamp: 2 }),
          pointer({ clientX: 30, pressure: 0.7, timeStamp: 3 }),
        ],
      }),
    );

    expect(scene.active?.points.map((point) => point.x)).toEqual([0, 10, 20]);
    expect(scene.active?.points.map((point) => point.time)).toEqual([1, 2, 3]);

    expect(scene.active?.points.map((point) => point.pressure)).toEqual([
      0.5, 0.6, 0.7,
    ]);

    input.up(pointer({ clientX: 40, buttons: 0, pressure: 0, timeStamp: 5 }));

    expect(
      (scene.strokes[0] as import("../board.types").Stroke)?.points.at(-1),
    ).toEqual({
      x: 30,
      y: 20,
      pressure: 0,
      time: 5,
    });
  });

  it("preserves pressure-only changes in raw samples", () => {
    const { input, scene } = setup();

    input.down(pointer());

    input.move(
      pointer({
        getCoalescedEvents: () => [
          pointer({ pressure: 0.6, timeStamp: 2 }),
          pointer({ pressure: 0.8, timeStamp: 3 }),
        ],
      }),
    );

    expect(scene.active?.points.map((point) => point.pressure)).toEqual([
      0.5, 0.6, 0.8,
    ]);
  });

  it("falls back to the original event when capability is absent, empty or throws", () => {
    const event = pointer();

    expect(BoardInput.eventSamples(event)).toEqual([event]);

    const empty = pointer({ getCoalescedEvents: () => [] });

    expect(BoardInput.eventSamples(empty)).toEqual([empty]);

    const throwing = pointer({
      getCoalescedEvents: () => {
        throw new Error("unsupported");
      },
    });

    expect(BoardInput.eventSamples(throwing)).toEqual([throwing]);
  });
});

describe("captured writing profiles", () => {
  it("captures color, highlighter width and opacity once without applying later settings to the active stroke", () => {
    const scene: Scene = { strokes: [], active: null };

    let writing = {
      ...BoardWriting.defaults(),
      instrument: "highlighter" as const,
    };

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: () => ({ x: 0, y: 0, zoom: 1 }),
      width: () => 3,
      writing: () => writing,

      onActiveChange: () => {},

      onCommit: (stroke) => scene.strokes.push(stroke),
    });

    expect(input.down(pointer())).toBe(true);

    writing = {
      ...writing,
      instruments: {
        ...writing.instruments,
        highlighter: {
          ...writing.instruments.highlighter,
          color: "#175cd3",
          width: 48,
          opacity: 0.6,
        },
      },
    };

    input.move(pointer({ clientX: 60, timeStamp: 8 }));
    input.up(pointer({ clientX: 70, timeStamp: 16, buttons: 0 }));

    expect(scene.strokes[0]).toMatchObject({
      color: "#f4c430",
      width: 20,
      style: { instrument: "highlighter", opacity: 0.3 },
    });

    input.down(pointer({ pointerId: 2 }));

    expect(scene.active).toMatchObject({
      color: "#175cd3",
      width: 48,
      style: { opacity: 0.6 },
    });
  });

  it("captures pressure strength zero for mouse and real pressure strength for a pen", () => {
    const scene: Scene = { strokes: [], active: null },
      writing = { ...BoardWriting.defaults(), instrument: "pressure" as const };

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: () => ({ x: 0, y: 0, zoom: 1 }),
      width: () => 3,
      writing: () => writing,

      onActiveChange: () => {},

      onCommit: () => {},
    });

    input.down(pointer({ pointerType: "mouse" }));
    expect(scene.active?.style?.pressureStrength).toBe(0);
    input.cancel();
    input.down(pointer());
    expect(scene.active?.style?.pressureStrength).toBe(65);
  });
});

it("requires explicit touch opt-in and keeps finger pressure response constant", () => {
  const scene: Scene = { strokes: [], active: null };
  const writing = BoardWriting.defaults();

  const input = new PenInput({
    scene,
    allowTouch: () => true,
    bounds: () => ({ left: 0, top: 0 }),
    viewport: BoardViewport.initialViewport,
    width: () => 3,
    writing: () => ({ ...writing, instrument: "pressure" }),
    onActiveChange: vi.fn(),
    onCommit: vi.fn(),
  });

  expect(input.down(pointer({ pointerType: "touch", pressure: 0.9 }))).toBe(
    true,
  );

  expect(scene.active?.style?.pressureStrength).toBe(0);
  expect(scene.active?.points[0]?.pressure).toBe(0.9);
});
