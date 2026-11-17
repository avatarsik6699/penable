import { describe, expect, it, vi } from "vitest";
import { Theme } from "~/shared/lib/theme";
import { PenInput } from "~/entities/board";
import { EraserInput } from "~/entities/board";
import { CanvasRenderer, type FrameScheduler } from "./renderer";
import {
  type ActiveStroke,
  type PointerInput,
  type Scene,
  BoardConstants,
} from "~/entities/board";
import { BoardViewport } from "~/entities/board";
import { BoardCoordinates } from "~/entities/board";
import { BoardRegions } from "~/entities/board";
import { BoardSelection } from "~/entities/board";
import { StrokeHistory } from "~/entities/board";

function layer() {
  const context = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    transform: vi.fn(),
    drawImage: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    lineWidth: 0,
    lineCap: "",
    lineJoin: "",
    fillStyle: "",
    strokeStyle: "",
  };

  const canvas = { width: 0, height: 0 };

  return {
    context,
    canvas,
    target: {
      canvas: canvas as HTMLCanvasElement,
      context: context as unknown as CanvasRenderingContext2D,
    },
  };
}

function frameClock() {
  let nextId = 0;
  const pending = new Map<number, () => void>();

  const frames: FrameScheduler = {
    request: vi.fn((callback) => {
      pending.set(++nextId, callback);

      return nextId;
    }),
    cancel: vi.fn((id) => {
      pending.delete(id);
    }),
  };

  return {
    frames,
    pending,

    run: () => {
      const callbacks = [...pending.values()];

      pending.clear();
      callbacks.forEach((callback) => callback());
    },
  };
}

function stroke(): ActiveStroke {
  return {
    id: 1,
    pointerId: 1,
    width: 3,
    color: BoardConstants.INK,
    points: [
      { x: 5, y: 7, pressure: 0.2, time: 1 },
      { x: 10, y: 15, pressure: 1, time: 2 },
      { x: 20, y: 9, pressure: 0.5, time: 3 },
    ],
  };
}

function pathCalls(context: ReturnType<typeof layer>["context"]) {
  return {
    moves: context.moveTo.mock.calls,
    lines: context.lineTo.mock.calls,
    curves: context.quadraticCurveTo.mock.calls,
    dots: context.arc.mock.calls,
  };
}

function setup(scene: Scene = { strokes: [], active: null }) {
  const completed = layer();
  const live = layer();
  const clock = frameClock();

  const renderer = new CanvasRenderer(
    completed.target,
    live.target,
    scene,
    BoardViewport.initialViewport(),
    clock.frames,
  );

  renderer.resize(200, 100, 1);
  clock.run();
  vi.clearAllMocks();

  return { renderer, completed, live, clock, scene };
}

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

describe("layered frame renderer", () => {
  it("repaints completed and active ink on theme change without replacing scene data or bitmap dimensions", () => {
    const committed = stroke();
    const active = { ...stroke(), id: 2 };
    const h = setup({ strokes: [committed], active });
    const before = structuredClone(h.scene);
    const size = { ...h.completed.canvas };

    h.renderer.setTheme("dark");
    h.renderer.setTheme("dark");
    expect(h.clock.pending.size).toBe(1);
    h.clock.run();

    expect(h.completed.context.strokeStyle).toBe(
      Theme.color(BoardConstants.INK, "dark"),
    );

    expect(h.live.context.strokeStyle).toBe(
      Theme.color(BoardConstants.INK, "dark"),
    );

    expect(h.scene.active).toBe(active);
    expect(h.scene.strokes[0]).toBe(committed);
    expect(h.scene).toEqual(before);
    expect(h.completed.canvas).toEqual(size);
    expect(h.completed.context.clearRect).toHaveBeenCalledOnce();
    expect(h.live.context.clearRect).toHaveBeenCalledOnce();

    h.renderer.setTheme("light");
    h.clock.run();
    expect(h.completed.context.strokeStyle).toBe(BoardConstants.INK);
    expect(h.live.context.strokeStyle).toBe(BoardConstants.INK);
    expect(h.scene).toEqual(before);
  });

  it("commits queued and subsequent ink with the current display color while preserving canonical ink", () => {
    const h = setup();
    const queued = stroke();

    h.scene.strokes.push(queued);
    h.renderer.commit(queued);
    h.renderer.setTheme("dark");
    h.clock.run();

    expect(h.completed.context.strokeStyle).toBe(
      Theme.color(queued.color, "dark"),
    );

    expect(queued.color).toBe(BoardConstants.INK);
    vi.clearAllMocks();

    const next = { ...stroke(), id: 2, color: "#175cd3" as const };

    h.scene.strokes.push(next);
    h.renderer.commit(next);
    h.clock.run();

    expect(h.completed.context.strokeStyle).toBe(
      Theme.color(next.color, "dark"),
    );

    expect(h.completed.context.clearRect).not.toHaveBeenCalled();
    expect(next.color).toBe("#175cd3");
    h.renderer.setTheme("dark");
    expect(h.clock.pending.size).toBe(0);
  });

  it("coalesces many updates into one clear and one full active path per frame", () => {
    const { renderer, scene, live, completed, clock } = setup();

    scene.active = stroke();

    for (let i = 0; i < 20; i++) renderer.activeChanged();

    expect(clock.pending.size).toBe(1);
    expect(live.context.stroke).not.toHaveBeenCalled();
    clock.run();
    expect(live.context.clearRect).toHaveBeenCalledOnce();
    expect(live.context.stroke).toHaveBeenCalledOnce();
    expect(live.context.moveTo).toHaveBeenCalledWith(5, 7);
    expect(live.context.quadraticCurveTo).toHaveBeenCalledWith(10, 15, 15, 12);
    expect(live.context.lineTo).toHaveBeenCalledWith(20, 9);
    expect(completed.context.clearRect).not.toHaveBeenCalled();
    expect(completed.context.stroke).not.toHaveBeenCalled();
  });

  it("does not redraw completed ink while live points arrive across frames", () => {
    const { renderer, scene, completed, live, clock } = setup({
      strokes: [stroke()],
      active: null,
    });

    scene.active = { ...stroke(), id: 2 };

    for (let i = 0; i < 3; i++) {
      scene.active.points.push({
        x: 25 + i,
        y: 10,
        pressure: 0.5,
        time: 4 + i,
      });

      renderer.activeChanged();
      clock.run();
    }

    expect(completed.context.clearRect).not.toHaveBeenCalled();
    expect(completed.context.stroke).not.toHaveBeenCalled();
    expect(live.context.stroke).toHaveBeenCalledTimes(3);
  });

  it.each(["off", "light", "strong", 65] as const)(
    "uses identical %s path commands for live, pressure-only up, commit and a later full redraw",
    (mode) => {
      const { renderer, scene, completed, live, clock } = setup();
      const ink = stroke();

      ink.stabilization =
        typeof mode === "number"
          ? { strength: mode, captureZoom: 2 }
          : { mode, captureZoom: 2 };

      scene.active = ink;
      renderer.activeChanged();
      clock.run();

      const livePath = structuredClone(pathCalls(live.context));

      ink.points.push({ ...ink.points.at(-1)!, pressure: 0, time: 4 });
      scene.active = null;
      scene.strokes.push(ink);
      renderer.commit(ink);
      clock.run();
      expect(pathCalls(completed.context)).toEqual(livePath);
      expect(live.context.clearRect).toHaveBeenCalledTimes(2);
      vi.clearAllMocks();
      renderer.setViewport({ zoom: 4, x: 10, y: -5 });
      renderer.resize(201, 100, 1);
      clock.run();
      expect(pathCalls(completed.context)).toEqual(livePath);
    },
  );

  it("retains every rapid tap and the next active stroke before a single RAF", () => {
    const { renderer, scene, completed, live, clock } = setup();
    const history = new StrokeHistory(scene.strokes);

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      width: () => 3,
      onActiveChange: () => renderer.activeChanged(),

      onCommit: (ink) => {
        history.commit(ink);
        renderer.commit(ink);
      },
    });

    for (let i = 0; i < 3; i++) {
      input.down(pointer({ clientX: i * 10 }));

      input.up(
        pointer({ clientX: i * 10, buttons: 0, pressure: 0, timeStamp: 2 }),
      );
    }

    input.down(pointer({ clientX: 99 }));
    expect(clock.pending.size).toBe(1);
    clock.run();
    expect(scene.strokes).toHaveLength(3);
    expect(completed.context.fill).toHaveBeenCalledTimes(3);

    expect(completed.context.arc.mock.calls.map((call) => call[0])).toEqual([
      0, 10, 20,
    ]);

    expect(live.context.arc).toHaveBeenCalledExactlyOnceWith(
      99,
      40,
      1.5,
      0,
      Math.PI * 2,
    );
  });

  it("removes a queued commit undone before RAF without painting a ghost stroke", () => {
    const original = stroke();

    const { renderer, scene, completed, live, clock } = setup({
      strokes: [original],
      active: null,
    });

    const history = new StrokeHistory(scene.strokes);

    const added = {
      ...stroke(),
      id: 2,
      points: [{ x: 500, y: 400, pressure: 0.5, time: 1 }],
    };

    history.commit(added);
    renderer.commit(added);
    history.undo();
    renderer.sceneChanged();
    expect(clock.pending.size).toBe(1);
    clock.run();
    expect(completed.context.clearRect).toHaveBeenCalledOnce();
    expect(completed.context.stroke).toHaveBeenCalledOnce();
    expect(completed.context.arc).not.toHaveBeenCalled();
    expect(completed.context.moveTo).toHaveBeenCalledExactlyOnceWith(5, 7);
    expect(live.context.clearRect).toHaveBeenCalledOnce();
    expect(scene.strokes[0]).toBe(original);
    expect(history.canRedo).toBe(true);
  });

  it("coalesces commit→undo→redo before RAF into one canonical redraw without duplicate ink", () => {
    const { renderer, scene, completed, clock } = setup();
    const history = new StrokeHistory(scene.strokes);
    const ink = stroke();

    history.commit(ink);
    renderer.commit(ink);
    history.undo();
    renderer.sceneChanged();
    history.redo();
    renderer.sceneChanged();
    expect(clock.pending.size).toBe(1);
    clock.run();
    expect(completed.context.stroke).toHaveBeenCalledOnce();
    expect(completed.context.clearRect).toHaveBeenCalledOnce();
    expect(scene.strokes[0]).toBe(ink);
  });

  it("coalesces viewport/resize redraws and avoids drawing queued commits twice", () => {
    const { renderer, scene, completed, clock } = setup();
    const ink = stroke();

    scene.strokes.push(ink);
    renderer.commit(ink);
    renderer.setViewport({ zoom: 2, x: 7, y: -5 });
    renderer.setViewport({ zoom: 4, x: 10, y: -7 });
    renderer.resize(300, 200, 2);
    expect(clock.pending.size).toBe(1);
    clock.run();
    expect(completed.context.stroke).toHaveBeenCalledOnce();
    expect(completed.context.clearRect).toHaveBeenCalledOnce();

    expect(completed.context.setTransform).toHaveBeenLastCalledWith(
      8,
      0,
      0,
      8,
      20,
      -14,
    );

    expect(completed.context.lineWidth).toBe(3);
    expect(ink.points[0]).toMatchObject({ x: 5, y: 7 });
  });

  it("changes raster for native pinch/DPR using actual rounded ratios; board zoom keeps bitmap size", () => {
    const { renderer, scene, completed, live, clock } = setup({
      strokes: [stroke()],
      active: null,
    });

    renderer.resize(101.25, 80.75, 1.5, 2);
    clock.run();
    expect(completed.canvas).toEqual({ width: 304, height: 242 });
    expect(live.canvas).toEqual(completed.canvas);

    expect(completed.context.setTransform).toHaveBeenLastCalledWith(
      304 / 101.25,
      0,
      0,
      242 / 80.75,
      0,
      0,
    );

    renderer.setViewport({ zoom: 4, x: 0, y: 0 });
    clock.run();
    expect(completed.canvas).toEqual({ width: 304, height: 242 });

    expect((scene.strokes[0] as import("~/entities/board").Stroke)?.width).toBe(
      3,
    );
  });

  it("does nothing for repeated size notifications and cancels scheduled work on disposal", () => {
    const { renderer, clock } = setup();

    expect(renderer.needsResize(200, 100, 1)).toBe(false);
    renderer.resize(200, 100, 1);
    expect(clock.pending.size).toBe(0);
    expect(renderer.needsResize(200, 100, 1, 2)).toBe(true);
    renderer.activeChanged();
    expect(clock.pending.size).toBe(1);
    renderer.dispose();
    expect(clock.pending.size).toBe(0);
    renderer.activeChanged();
    expect(clock.pending.size).toBe(0);
  });

  it("keeps both-layer memory inside the budget after every dimension write during orientation swaps", () => {
    const sizes = [
      { width: 0, height: 0 },
      { width: 0, height: 0 },
    ];

    const allocations: number[] = [];

    const totalPixels = () =>
      sizes.reduce((sum, size) => sum + size.width * size.height, 0);

    const trackedCanvas = (index: number): HTMLCanvasElement => {
      const size = sizes[index]!;

      return {
        get width() {
          return size.width;
        },
        set width(value: number) {
          size.width = value;
          allocations.push(totalPixels());
        },
        get height() {
          return size.height;
        },
        set height(value: number) {
          size.height = value;
          allocations.push(totalPixels());
        },
      } as HTMLCanvasElement;
    };

    const completed = { ...layer().target, canvas: trackedCanvas(0) };
    const live = { ...layer().target, canvas: trackedCanvas(1) };
    const clock = frameClock();

    const renderer = new CanvasRenderer(
      completed,
      live,
      { strokes: [], active: null },
      BoardViewport.initialViewport(),
      clock.frames,
    );

    for (const [width, height] of [
      [1024, 8192],
      [8192, 1024],
      [1024, 8192],
    ] as const) {
      renderer.resize(width, height, 1);
      clock.run();

      expect(sizes).toEqual([
        { width, height },
        { width, height },
      ]);
    }

    expect(Math.max(...allocations)).toBe(BoardCoordinates.BITMAP_PIXEL_BUDGET);

    expect(
      allocations.every(
        (pixels) => pixels <= BoardCoordinates.BITMAP_PIXEL_BUDGET,
      ),
    ).toBe(true);
  });

  it("clears only the live layer when a stroke is cancelled before or after its first frame", () => {
    const { renderer, scene, live, completed, clock } = setup({
      strokes: [stroke()],
      active: null,
    });

    scene.active = { ...stroke(), id: 2 };
    renderer.activeChanged();
    clock.run();
    scene.active = null;
    renderer.activeChanged();
    clock.run();
    expect(live.context.clearRect).toHaveBeenCalledTimes(2);
    expect(live.context.stroke).toHaveBeenCalledOnce();
    expect(completed.context.clearRect).not.toHaveBeenCalled();
    expect(completed.context.stroke).not.toHaveBeenCalled();
    scene.active = stroke();
    renderer.activeChanged();
    scene.active = null;
    renderer.activeChanged();
    clock.run();
    expect(live.context.stroke).toHaveBeenCalledOnce();
  });
});

describe("eraser preview rendering", () => {
  it("drops queued commits hidden before RAF and restores canonical ink on cancellation", () => {
    const { renderer, scene, completed, clock } = setup();
    const ink = stroke();

    scene.strokes.push(ink);
    renderer.commit(ink);

    const input = new EraserInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      onPreviewChange: () => renderer.setEraserPreview(input.preview),
      onCommit: vi.fn(),
    });

    input.down(pointer({ clientX: 5, clientY: 7 }));
    clock.run();
    expect(completed.context.clearRect).toHaveBeenCalledOnce();
    expect(completed.context.stroke).not.toHaveBeenCalled();
    expect(scene.strokes[0]).toBe(ink);
    input.cancel();
    clock.run();
    expect(completed.context.stroke).toHaveBeenCalledOnce();
    expect(completed.context.clearRect).toHaveBeenCalledTimes(2);
  });

  it("coalesces erase, undo and redo with pending ink without ghosts or duplicate paths", () => {
    const ink = stroke();

    const { renderer, scene, completed, clock } = setup({
      strokes: [ink],
      active: null,
    });

    const history = new StrokeHistory(scene.strokes, 1);
    const added = { ...stroke(), id: 2 };

    history.commit(added);
    renderer.commit(added);

    const input = new EraserInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      onPreviewChange: () => renderer.setEraserPreview(input.preview),

      onCommit: (strokes) => {
        history.erase(strokes);
        renderer.sceneChanged();
      },
    });

    input.down(pointer({ clientX: 5, clientY: 7 }));
    input.up(pointer({ clientX: 5, clientY: 7, buttons: 0 }));
    history.undo();
    renderer.sceneChanged();
    clock.run();
    expect(completed.context.stroke).toHaveBeenCalledTimes(2);
    expect(completed.context.clearRect).toHaveBeenCalledOnce();
    vi.clearAllMocks();
    history.redo();
    renderer.sceneChanged();
    clock.run();
    expect(completed.context.stroke).not.toHaveBeenCalled();
    expect(completed.context.clearRect).toHaveBeenCalledOnce();
    expect(scene.strokes).toEqual([]);
  });

  it("keys preview by object identity when a numeric stroke ID is reused", () => {
    const hidden = stroke();

    const replacement = {
      ...stroke(),
      points: [{ x: 99, y: 100, pressure: 1, time: 1 }],
    };

    const { renderer, completed, clock } = setup({
      strokes: [replacement],
      active: null,
    });

    renderer.setEraserPreview(new Set([hidden]));
    clock.run();

    expect(completed.context.arc).toHaveBeenCalledExactlyOnceWith(
      99,
      100,
      1.5,
      0,
      Math.PI * 2,
    );
  });
});

describe("fragment rendering transactions", () => {
  it("paints complementary clips from one source once and balances clipping state", () => {
    const original = stroke();

    const [part] = BoardRegions.selectParts(
      [original],
      BoardRegions.rectangle({ x: 8, y: 0 }, { x: 15, y: 25 }),
      () => 2,
    );

    const h = setup({
      strokes: [part!.selected, part!.remainder!],
      active: null,
    });

    h.renderer.sceneChanged();
    h.clock.run();
    expect(h.completed.context.stroke).toHaveBeenCalledOnce();
    expect(h.completed.context.clip).toHaveBeenCalledWith("nonzero");
    expect(h.completed.context.save).toHaveBeenCalledOnce();
    expect(h.completed.context.restore).toHaveBeenCalledOnce();
  });

  it("preview never mutates canonical scene and cancel restores it even before a queued frame", () => {
    const original = stroke(),
      h = setup({ strokes: [original], active: null });

    h.renderer.setSelectionPreview({
      stationary: [],
      selected: [original],
      delta: { x: 20, y: 10 },
    });

    h.clock.run();
    expect(h.scene.strokes[0]).toBe(original);

    expect(h.live.context.setTransform).toHaveBeenLastCalledWith(
      1,
      0,
      0,
      1,
      20,
      10,
    );

    vi.clearAllMocks();
    h.renderer.setSelectionPreview(null);
    h.clock.run();
    expect(h.completed.context.stroke).toHaveBeenCalledOnce();
    expect(h.completed.context.translate).not.toHaveBeenCalled();
  });
});

describe("selection frame efficiency", () => {
  it("keeps stationary ink on the completed layer across move frames and coalesces live updates", () => {
    const original = stroke(),
      stationary = { ...stroke(), id: 2 };

    const h = setup({ strokes: [original, stationary], active: null });
    const base = { stationary: [stationary], selected: [original] };

    h.renderer.setSelectionPreview({ ...base, delta: { x: 1, y: 0 } });
    h.clock.run();
    vi.clearAllMocks();

    for (let i = 2; i <= 20; i++)
      h.renderer.setSelectionPreview({ ...base, delta: { x: i, y: 0 } });

    expect(h.clock.pending.size).toBe(1);
    h.clock.run();
    expect(h.completed.context.clearRect).not.toHaveBeenCalled();
    expect(h.completed.context.stroke).not.toHaveBeenCalled();
    expect(h.live.context.stroke).toHaveBeenCalledOnce();

    expect(h.live.context.setTransform).toHaveBeenLastCalledWith(
      1,
      0,
      0,
      1,
      20,
      0,
    );

    h.renderer.setSelectionPreview({ ...base, delta: { x: 0, y: 0 } });
    h.clock.run();
    expect(h.completed.context.stroke).toHaveBeenCalledTimes(2);
    expect(h.live.context.clearRect).toHaveBeenCalledTimes(2);
  });

  it("does not reuse stale active geometry when the same mutable point array grows", () => {
    const h = setup(),
      active = stroke();

    h.scene.active = active;
    h.renderer.activeChanged();
    h.clock.run();
    vi.clearAllMocks();
    active.points.push({ x: 30, y: 40, time: 4, pressure: 1 });
    h.renderer.activeChanged();
    h.clock.run();
    expect(h.live.context.lineTo).toHaveBeenCalledWith(30, 40);
  });
});

describe("batched renderer state without merging ink", () => {
  it("reuses grouping, styles and a common matrix while retaining individual fills and local clips", () => {
    const h = setup(),
      sourceReads = vi.fn(() => "source");

    const dot = (id: number, x: number, width: number) => ({
      id,
      color: BoardConstants.INK,
      width,
      source: `dot-${id}`,
      translation: { x: 3, y: 4 },
      points: [{ x, y: 20, time: 0, pressure: 1 }],
    });

    const a = dot(1, 10, 2),
      b = {
        ...dot(2, 20, 4),
        clip: BoardRegions.rectangle({ x: 15, y: 15 }, { x: 25, y: 25 }),
      },
      c = dot(3, 30, 4);

    Object.defineProperty(a, "source", { get: sourceReads });

    const base = { stationary: [], selected: [a, b, c] };
    let width = 0;

    const widths = vi.fn((value: number) => {
      width = value;
    });

    Object.defineProperty(h.live.context, "lineWidth", {
      get: () => width,
      set: widths,
      configurable: true,
    });

    h.renderer.setSelectionPreview({ ...base, delta: { x: 5, y: 6 } });
    h.clock.run();
    expect(h.live.context.fill).toHaveBeenCalledTimes(3);
    expect(h.live.context.translate).not.toHaveBeenCalled();
    expect(h.live.context.save).toHaveBeenCalledOnce();
    expect(h.live.context.restore).toHaveBeenCalledOnce();
    expect(widths.mock.calls.map((call) => call[0])).toEqual([2, 4]);

    expect(h.live.context.setTransform.mock.calls).toEqual([
      [1, 0, 0, 1, 0, 0],
      [1, 0, 0, 1, 8, 10],
    ]);

    const reads = sourceReads.mock.calls.length;

    vi.clearAllMocks();
    h.renderer.setSelectionPreview({ ...base, delta: { x: 7, y: 8 } });
    h.clock.run();
    expect(sourceReads).not.toHaveBeenCalled();
    expect(reads).toBeGreaterThan(0);
    expect(h.live.context.fill).toHaveBeenCalledTimes(3);

    expect(h.live.context.setTransform.mock.calls).toEqual([
      [1, 0, 0, 1, 0, 0],
      [1, 0, 0, 1, 10, 12],
    ]);

    h.renderer.resize(201, 101, 2);
    h.clock.run();
    expect(widths.mock.calls.map((call) => call[0])).toEqual([2, 4, 2, 4]);
  });

  it("preserves the original fractional setTransform then translate arithmetic order", () => {
    const h = setup(),
      viewport = { zoom: 1.7, x: 3.1, y: -8.3 },
      offset = { x: 0.3, y: -0.7 },
      delta = { x: 0.123, y: 0.456 };

    const original = { ...stroke(), translation: offset, source: "source" };

    h.renderer.resize(201.3, 102.7, 1.25);
    h.renderer.setViewport(viewport);

    h.renderer.setSelectionPreview({
      stationary: [],
      selected: [original],
      delta,
    });

    h.clock.run();

    const { scaleX, scaleY } = h.renderer.resolution;

    expect(h.live.context.setTransform).toHaveBeenLastCalledWith(
      scaleX * viewport.zoom,
      0,
      0,
      scaleY * viewport.zoom,
      scaleX * (viewport.x + delta.x * viewport.zoom) +
        scaleX * viewport.zoom * offset.x,
      scaleY * (viewport.y + delta.y * viewport.zoom) +
        scaleY * viewport.zoom * offset.y,
    );

    expect(h.live.context.translate).not.toHaveBeenCalled();
    expect(h.live.context.save).not.toHaveBeenCalled();
  });

  it("invalidates canonical grouping when a commit is followed by a viewport redraw", () => {
    const h = setup({ strokes: [stroke()], active: null }),
      added = {
        ...stroke(),
        id: 2,
        points: [{ x: 50, y: 20, time: 0, pressure: 1 }],
      };

    h.scene.strokes.push(added);
    h.renderer.commit(added);
    h.clock.run();
    vi.clearAllMocks();
    h.renderer.setViewport({ zoom: 2, x: 0, y: 0 });
    h.clock.run();
    expect(h.completed.context.stroke).toHaveBeenCalledOnce();
    expect(h.completed.context.fill).toHaveBeenCalledOnce();
  });
});

describe("idle selection cancellation after pen commit", () => {
  it("retains a completed pen stroke queued before an idle cancel/clear and the next frame", () => {
    const h = setup(),
      selection = new BoardSelection({
        scene: h.scene,
        viewport: BoardViewport.initialViewport,
        bounds: () => ({ left: 0, top: 0, width: 200, height: 100 }),
        writable: () => true,

        validate: () => {},

        commit: () => {},

        preview: (preview) => h.renderer.setSelectionPreview(preview),

        changed: () => {},

        setViewport: () => {},
      });

    const input = new PenInput({
      scene: h.scene,
      viewport: BoardViewport.initialViewport,
      bounds: () => ({ left: 0, top: 0 }),
      width: () => 3,
      onActiveChange: () => h.renderer.activeChanged(),

      onCommit: (ink) => {
        h.scene.strokes.push(ink);
        h.renderer.commit(ink);
      },
    });

    input.down(pointer({ clientX: 20, clientY: 20 }));

    input.up(
      pointer({
        clientX: 20,
        clientY: 20,
        buttons: 0,
        pressure: 0,
        timeStamp: 2,
      }),
    );

    expect(h.scene.strokes).toHaveLength(1);
    expect(h.completed.context.fill).not.toHaveBeenCalled();
    selection.cancel();
    selection.clear();
    h.clock.run();
    expect(h.completed.context.fill).toHaveBeenCalledOnce();

    expect(h.completed.context.arc).toHaveBeenCalledWith(
      20,
      20,
      1.5,
      0,
      Math.PI * 2,
    );

    h.renderer.sceneChanged();
    h.clock.run();
    expect(h.completed.context.fill).toHaveBeenCalledTimes(2);
  });
});

describe("mixed ordered selection preview", () => {
  it.each(["ink", "image"] as const)(
    "keeps selected lower %s below a later opaque image during drag and resize",
    (kind) => {
      const imageAsset = (id: string, width: number) => ({
        id,
        mime: "image/png" as const,
        width,
        height: 30,
        base64: "",
      });

      const lower: import("~/entities/board").BoardItem =
        kind === "ink"
          ? {
              id: 1,
              color: BoardConstants.INK,
              width: 2,
              points: [
                { x: 5, y: 10, pressure: 0.5, time: 0 },
                { x: 20, y: 10, pressure: 0.5, time: 1 },
              ],
            }
          : {
              kind: "image",
              id: 1,
              matrix: [1, 0, 0, 1, 0, 0],
              asset: imageAsset("lower", 20),
            };

      const upper: import("~/entities/board").ImageItem = {
          kind: "image",
          id: 2,
          matrix: [1, 0, 0, 1, 40, 0],
          asset: imageAsset("upper", 100),
        },
        scene: Scene = { strokes: [lower, upper], active: null };

      const completed = layer(),
        live = layer(),
        clock = frameClock(),
        order: string[] = [],
        bitmapLower = {} as CanvasImageSource,
        bitmapUpper = {} as CanvasImageSource;

      completed.context.stroke.mockImplementation(() => order.push("lower"));
      live.context.stroke.mockImplementation(() => order.push("lower"));

      const record = (bitmap: unknown) => {
        order.push(bitmap === bitmapUpper ? "upper" : "lower");
      };

      completed.context.drawImage.mockImplementation(record);
      live.context.drawImage.mockImplementation(record);

      const renderer = new CanvasRenderer(
        completed.target,
        live.target,
        scene,
        { x: 0, y: 0, zoom: 1 },
        clock.frames,
        (asset) => (asset.id === "upper" ? bitmapUpper : bitmapLower),
      );

      renderer.resize(800, 600, 1);
      clock.run();
      order.length = 0;

      const selection = new BoardSelection({
        scene,
        viewport: () => ({ x: 0, y: 0, zoom: 1 }),
        bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        writable: () => true,

        validate: () => {},

        commit: () => {},

        preview: (value) => renderer.setSelectionPreview(value),

        changed: () => {},

        setViewport: () => {},
      });

      selection.down(pointer({ clientX: 0, clientY: 0 }));
      selection.up(pointer({ clientX: 30, clientY: 35, buttons: 0 }));
      selection.down(pointer({ clientX: 15, clientY: 17 }));
      selection.move(pointer({ clientX: 65, clientY: 17 }));
      clock.run();
      expect(order).toEqual(["lower", "upper"]);
      expect(live.context.stroke).not.toHaveBeenCalled();
      expect(live.context.drawImage).not.toHaveBeenCalled();
      order.length = 0;
      selection.move(pointer({ clientX: 70, clientY: 17 }));
      clock.run();
      expect(order).toEqual(["lower", "upper"]);
      selection.cancel();
      clock.run();
      order.length = 0;
      selection.down(pointer({ clientX: 30, clientY: 35 }));
      selection.move(pointer({ clientX: 100, clientY: 35 }));
      clock.run();
      expect(order).toEqual(["lower", "upper"]);
      expect(scene.strokes).toEqual([lower, upper]);
      renderer.dispose();
    },
  );
});
