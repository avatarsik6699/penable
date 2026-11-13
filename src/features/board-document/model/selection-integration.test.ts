import { describe, expect, it, vi } from "vitest";
import {
  BoardSelection,
  type SelectionPreview,
  BoardSelectionHelpers,
  StrokeHistory,
  type PointerInput,
  type Scene,
  type Stroke,
  type Viewport,
  BoardConstants,
  BoardRegions,
} from "~/entities/board";
import { DocumentCodec } from "../modules/codec";

const ink = (id = 1): Stroke => ({
  id,
  width: 4,
  color: BoardConstants.INK,
  points: [
    { x: 0, y: 50, pressure: 0.5, time: 0 },
    { x: 100, y: 50, pressure: 0.5, time: 1 },
  ],
});

const pointer = (
  x: number,
  y: number,
  overrides: Partial<PointerInput> = {},
): PointerInput => ({
  clientX: x,
  clientY: y,
  pointerId: 1,
  pointerType: "pen",
  button: 0,
  buttons: 1,
  isPrimary: true,
  pressure: 0.5,
  timeStamp: 0,
  ...overrides,
});

function harness(
  strokes = [ink()],
  writable = true,
  overrides: Partial<ConstructorParameters<typeof BoardSelection>[0]> = {},
) {
  const scene: Scene = { strokes, active: null },
    history = new StrokeHistory(strokes, strokes.length);

  let viewport: Viewport = { x: 0, y: 0, zoom: 1 },
    preview: SelectionPreview | null = null,
    commits = 0,
    fail = false;

  const selection = new BoardSelection({
    scene,
    viewport: () => viewport,
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    writable: () => writable,
    clipboard: { strokes: [] },

    validate: (strokes) => {
      if (fail) throw new Error("limit");

      DocumentCodec.decodeDocument({
        ...DocumentCodec.emptyDocument(),
        strokes,
      });
    },

    commit: (strokes) => {
      history.replace(strokes);
      commits++;
    },

    preview: (strokes) => {
      preview = strokes;
    },

    changed: () => {},

    setViewport: (value) => {
      viewport = value;
    },

    ...overrides,
  });

  const select = () => {
    selection.down(pointer(20, 40));
    selection.move(pointer(40, 60));
    selection.up(pointer(40, 60, { buttons: 0 }));
  };

  return {
    scene,
    history,
    selection,
    select,
    preview: () => preview,
    commits: () => commits,
    viewport: () => viewport,

    fail: () => {
      fail = true;
    },
  };
}

describe("selection transactions and ownership", () => {
  it("selects and copies without changing scene/history, ignores foreign pointers, keeps redo on zero drag", () => {
    const h = harness(),
      original = h.scene.strokes[0];

    h.select();
    h.selection.copy();
    expect(h.commits()).toBe(0);
    expect(h.scene.strokes[0]).toBe(original);
    expect(h.selection.hasClipboard).toBe(true);
    h.selection.down(pointer(30, 50));
    expect(h.selection.move(pointer(50, 50, { pointerId: 2 }))).toBe(false);
    h.selection.up(pointer(30, 50, { buttons: 0 }));
    expect(h.commits()).toBe(0);
  });

  it("previews partial move, commits one replacement and undo restores original objects", () => {
    const h = harness(),
      original = h.scene.strokes[0];

    h.select();
    h.selection.down(pointer(30, 50));
    h.selection.move(pointer(70, 70));
    expect(h.scene.strokes).toHaveLength(1);

    expect(h.preview()!.stationary.length + h.preview()!.selected.length).toBe(
      2,
    );

    h.selection.up(pointer(70, 70, { buttons: 0 }));
    expect(h.commits()).toBe(1);
    expect(h.scene.strokes).toHaveLength(2);
    expect(h.selection.selected[0]!.points).toBe(original!.points);
    h.history.undo();
    expect(h.scene.strokes).toEqual([original]);
    expect(h.scene.strokes[0]).toBe(original);
  });

  it("cancel restores viewport and transient scene after edge-pan, no-op keeps redo", () => {
    const h = harness();

    h.select();
    h.selection.down(pointer(30, 50));
    h.selection.move(pointer(799, 50));
    expect(h.selection.edgePan({ x: 799, y: 50 }, 1)).toBe(true);
    expect(h.viewport().x).toBeGreaterThanOrEqual(-30);
    h.selection.cancel();
    expect(h.viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(h.preview()).toBeNull();
    expect(h.commits()).toBe(0);
  });

  it("cut and paste are separate edits, preserve immutable internal copy, center paste and refresh lineage", () => {
    const h = harness();

    h.select();

    const originalSource = h.selection.selected[0]!.source;

    h.selection.remove(true);
    expect(h.scene.strokes).toHaveLength(1);
    expect(h.selection.hasSelection).toBe(false);
    h.selection.insert();

    const selected = h.selection.selected[0]!;

    expect(selected.source).not.toBe(originalSource);

    const bounds = BoardRegions.visibleBounds([selected])!;

    expect((bounds.left + bounds.right) / 2).toBe(400);
    expect((bounds.top + bounds.bottom) / 2).toBe(300);
    expect(h.commits()).toBe(2);
    h.history.undo();
    h.history.undo();
    expect(h.scene.strokes).toHaveLength(1);
  });

  it("a held nudge is one action, can be cancelled, and duplicates use 24 CSS pixels", () => {
    const h = harness();

    h.selection.all();
    h.selection.nudge(1, 0);
    h.selection.nudge(10, 0);
    expect(h.commits()).toBe(0);
    h.selection.finishNudge();
    expect(h.commits()).toBe(1);
    expect(h.selection.selected[0]!.translation!.x).toBe(11);
    h.selection.nudge(1, 0);
    h.selection.cancel();
    expect(h.selection.selected[0]!.translation!.x).toBe(11);
    h.selection.insert(true);
    expect(h.selection.selected[0]!.translation!.x).toBe(35);
  });

  it("validation failure preserves scene, selection and redo without partial delete/paste", () => {
    const h = harness();

    h.selection.all();
    h.selection.insert(true);
    h.history.undo();
    h.selection.clear();
    h.select();

    const originals = [...h.scene.strokes],
      selected = h.selection.selected,
      before = h.commits();

    h.fail();
    h.selection.remove(true);
    expect(h.scene.strokes).toEqual(originals);
    expect(h.selection.selected).toEqual(selected);
    expect(h.commits()).toBe(before);
    expect(h.history.canRedo).toBe(true);
    expect(h.selection.message).toBe("limit");
  });

  it("read-only supports selection/copy while guarding every mutation", () => {
    const h = harness([ink()], false);

    h.select();
    h.selection.copy();
    h.selection.remove(true);
    h.selection.insert();
    h.selection.nudge(1, 0);
    expect(h.selection.hasSelection).toBe(true);
    expect(h.selection.hasClipboard).toBe(true);
    expect(h.commits()).toBe(0);
    expect(h.selection.down(pointer(30, 50))).toBe(true);
    expect(h.selection.moving).toBe(false);
  });

  it("fixes membership when moved over unrelated ink and supports lasso", () => {
    const h = harness([
      ink(),
      { ...ink(2), points: [{ x: 150, y: 50, time: 0, pressure: 1 }] },
    ]);

    h.selection.shape = "lasso";
    h.selection.down(pointer(20, 40));
    h.selection.move(pointer(40, 40));
    h.selection.move(pointer(40, 60));
    h.selection.move(pointer(20, 60));
    h.selection.up(pointer(20, 40, { buttons: 0 }));
    expect(h.selection.selected).toHaveLength(1);
    h.selection.down(pointer(30, 50));
    h.selection.up(pointer(150, 50, { buttons: 0 }));
    expect(h.selection.selected).toHaveLength(1);

    expect(h.scene.strokes.some((s) => s.id === 2 && !s.translation)).toBe(
      true,
    );
  });
});

describe("selection primary-button contract", () => {
  it.each([
    ["mouse", 3],
    ["mouse", 5],
    ["pen", 3],
  ] as const)(
    "cancels %s chord/buttons=%s without committing preview",
    (pointerType, buttons) => {
      const h = harness(),
        original = h.scene.strokes[0];

      h.selection.all();
      h.selection.down(pointer(30, 50, { pointerType }));
      h.selection.move(pointer(40, 50, { pointerType }));
      expect(h.preview()).not.toBeNull();
      h.selection.move(pointer(50, 50, { pointerType, buttons }));
      expect(h.selection.pointerId).toBeNull();
      expect(h.preview()).toBeNull();

      expect(
        h.selection.up(pointer(60, 50, { pointerType, button: 2, buttons: 0 })),
      ).toBe(false);

      expect(h.scene.strokes[0]).toBe(original);
      expect(h.commits()).toBe(0);
      expect(h.history.canUndo).toBe(false);
      expect(h.selection.hasSelection).toBe(true);
    },
  );

  it.each(["mouse", "pen"])(
    "ignores a secondary %s release until primary release or cancel",
    (pointerType) => {
      const h = harness();

      h.selection.all();
      h.selection.down(pointer(30, 50, { pointerType }));
      h.selection.move(pointer(40, 50, { pointerType }));

      expect(
        h.selection.up(pointer(70, 50, { pointerType, button: 2, buttons: 1 })),
      ).toBe(false);

      expect(h.selection.pointerId).toBe(1);
      expect(h.commits()).toBe(0);
      h.selection.up(pointer(50, 50, { pointerType, button: 0, buttons: 0 }));
      expect(h.commits()).toBe(1);
      expect(h.selection.selected[0]!.translation!.x).toBe(20);
    },
  );
});

describe("selection batch budgets", () => {
  it("duplicates 10000 dots into a supported 20000-item scene in one transaction", () => {
    const dots = Array.from({ length: 10000 }, (_, i) => ({
      ...ink(i + 1),
      points: [{ x: i % 100, y: Math.floor(i / 100), pressure: 1, time: 0 }],
    }));

    const h = harness(dots);

    h.selection.all();

    const start = performance.now();

    h.selection.insert(true);
    expect(h.scene.strokes).toHaveLength(20000);
    expect(h.commits()).toBe(1);

    expect(new Set(h.scene.strokes.map((stroke) => stroke.id)).size).toBe(
      20000,
    );

    expect(performance.now() - start).toBeLessThan(2000);
  });

  it("preflights item and repeated point budgets without changing selection/history", () => {
    const dots = Array.from({ length: 10001 }, (_, i) => ({
      ...ink(i + 1),
      points: [{ x: 0, y: 50, pressure: 1, time: 0 }],
    }));

    const h = harness(dots);

    h.selection.all();
    h.selection.insert(true);
    expect(h.selection.message).toContain("20 000");
    expect(h.scene.strokes).toHaveLength(10001);
    expect(h.commits()).toBe(0);

    const point = { x: 0, y: 50, pressure: 1, time: 0 },
      repeated = Array.from({ length: 100000 }, () => point);

    const points = harness(
      Array.from({ length: 6 }, (_, i) => ({
        ...ink(i + 1),
        points: repeated,
      })),
    );

    points.selection.all();
    points.selection.insert(true);
    expect(points.selection.message).toContain("1 000 000");
    expect(points.commits()).toBe(0);
    expect(points.selection.selected).toHaveLength(6);
  });
});

describe("retained selection area", () => {
  it("retains the exact rectangle including blank margins and can drag by those margins", () => {
    const h = harness();

    h.selection.down(pointer(10, 10));
    h.selection.up(pointer(80, 90, { buttons: 0 }));

    expect(h.selection.outline).toEqual([
      [
        [
          [10, 10],
          [80, 10],
          [80, 90],
          [10, 90],
          [10, 10],
        ],
      ],
    ]);

    expect(h.selection.hit({ x: 15, y: 15 })).toBe(true);
    h.selection.down(pointer(15, 15));
    h.selection.up(pointer(25, 35, { buttons: 0 }));

    expect(h.selection.outline).toEqual([
      [
        [
          [20, 30],
          [90, 30],
          [90, 110],
          [20, 110],
          [20, 30],
        ],
      ],
    ]);

    expect(h.selection.selected[0]!.translation).toEqual({ x: 10, y: 20 });
    h.selection.nudge(1, 0);
    h.selection.nudge(10, 0);
    h.selection.finishNudge();
    expect(h.selection.outline[0]![0]![0]).toEqual([31, 30]);
    h.selection.nudge(100, 0);
    h.selection.cancel();
    expect(h.selection.outline[0]![0]![0]).toEqual([31, 30]);
  });

  it("copies and pastes the area rather than centering the selected ink", () => {
    const h = harness();

    h.selection.down(pointer(-20, 10));
    h.selection.up(pointer(60, 110, { buttons: 0 }));
    h.selection.copy();
    h.selection.clear();
    h.selection.insert();

    expect(h.selection.outline).toEqual([
      [
        [
          [360, 250],
          [440, 250],
          [440, 350],
          [360, 350],
          [360, 250],
        ],
      ],
    ]);

    expect(h.selection.selected[0]!.translation).toEqual({ x: 380, y: 240 });
    h.selection.insert(true);
    expect(h.selection.outline[0]![0]![0]).toEqual([384, 274]);
  });

  it("retains a normalized lasso shape through release and movement", () => {
    const h = harness();

    h.selection.shape = "lasso";
    h.selection.down(pointer(10, 10));
    h.selection.move(pointer(90, 50));
    h.selection.move(pointer(10, 90));
    h.selection.up(pointer(10, 10, { buttons: 0 }));

    const area = structuredClone(h.selection.outline);

    expect(area[0]![0]).toHaveLength(4);
    expect(h.selection.hit({ x: 80, y: 15 })).toBe(false);
    h.selection.down(pointer(20, 50));
    h.selection.up(pointer(30, 60, { buttons: 0 }));

    expect(h.selection.outline).toEqual(
      area.map((p) => p.map((r) => r.map(([x, y]) => [x + 10, y + 10]))),
    );
  });

  it("shows an empty selected area without mutating history or clipboard", () => {
    const h = harness();

    h.selection.down(pointer(150, 150));
    h.selection.up(pointer(200, 220, { buttons: 0 }));
    expect(h.selection.hasSelection).toBe(false);
    expect(h.selection.outline[0]![0]).toHaveLength(5);
    h.selection.copy();
    h.selection.remove(true);
    h.selection.insert(true);
    expect(h.commits()).toBe(0);
    expect(h.selection.hasClipboard).toBe(false);
    h.selection.clear();
    expect(h.selection.outline).toEqual([]);
  });
});

function deferredSelection<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;

  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

describe("cancellable background preparation", () => {
  it("ignores stale geometry after cancel and retains the old selection/region", async () => {
    const pending =
      deferredSelection<
        ReturnType<typeof BoardSelectionHelpers.prepareSelection>
      >();

    let signal: AbortSignal | null = null;

    const h = harness(undefined, true, {
      select: (_input, current) => {
        signal = current;

        return pending.promise;
      },
    });

    h.select();
    expect(h.selection.busy).toBe(true);
    expect(h.commits()).toBe(0);

    const prepared = BoardSelectionHelpers.prepareSelection(h.scene.strokes, {
      shape: "rectangle",
      points: [
        { x: 20, y: 40 },
        { x: 40, y: 60 },
      ],
    });

    expect(h.selection.outline).toEqual(prepared.region);
    h.selection.cancel();
    expect(h.selection.message).toBe("");
    expect((signal as AbortSignal | null)?.aborted).toBe(true);
    pending.resolve(prepared);
    await Promise.resolve();
    await Promise.resolve();
    expect(h.selection.hasSelection).toBe(false);
    expect(h.selection.outline).toEqual([]);
    expect(h.selection.busy).toBe(false);
  });

  it("keeps move preview atomic until validation and restores edge-pan on cancellation", async () => {
    const pending = deferredSelection<void>(),
      h = harness(undefined, true, { validate: () => pending.promise });

    h.select();

    const region = structuredClone(h.selection.outline),
      original = h.scene.strokes[0];

    h.selection.down(pointer(30, 50));
    h.selection.move(pointer(799, 50));
    h.selection.edgePan({ x: 799, y: 50 }, 0.05);
    h.selection.up(pointer(799, 50, { buttons: 0 }));
    expect(h.selection.busy).toBe(true);
    expect(h.scene.strokes[0]).toBe(original);
    expect(h.commits()).toBe(0);
    h.selection.cancel();
    pending.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.commits()).toBe(0);
    expect(h.viewport()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(h.selection.outline).toEqual(region);
    expect(h.preview()).toBeNull();
  });

  it("commits once on successful validation and rejects a late readonly result", async () => {
    const pending = deferredSelection<void>(),
      h = harness(undefined, true, { validate: () => pending.promise });

    h.select();
    h.selection.down(pointer(30, 50));
    h.selection.up(pointer(50, 50, { buttons: 0 }));
    expect(h.commits()).toBe(0);
    pending.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(h.commits()).toBe(1);
    expect(h.selection.busy).toBe(false);
    expect(h.selection.outline[0]![0]![0]).toEqual([40, 40]);

    const other = deferredSelection<void>();
    let writable = true;

    const denied = harness(undefined, true, {
      writable: () => writable,
      validate: () => other.promise,
    });

    denied.select();
    denied.selection.remove(true);
    writable = false;
    other.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(denied.commits()).toBe(0);
    expect(denied.selection.hasClipboard).toBe(false);
    expect(denied.selection.hasSelection).toBe(true);
  });
});

describe("actionable fragment-count preflight", () => {
  it("rejects a near-limit partial move before validation while preserving selection, scene and redo; cut still works", () => {
    const dots = Array.from({ length: 19999 }, (_, i) => ({
      ...ink(i + 2),
      points: [{ x: 10000 + i, y: 10000, time: 0, pressure: 1 }],
    }));

    const validate = vi.fn(),
      h = harness([ink(), ...dots], true, { validate });

    h.history.commit({
      ...ink(20001),
      points: [{ x: 50000, y: 50000, time: 0, pressure: 1 }],
    });

    h.history.undo();
    h.select();

    const selected = h.selection.selected,
      area = structuredClone(h.selection.outline),
      originals = [...h.scene.strokes];

    h.selection.down(pointer(30, 50));
    h.selection.up(pointer(40, 60, { buttons: 0 }));
    expect(validate).not.toHaveBeenCalled();
    expect(h.commits()).toBe(0);
    expect(h.selection.busy).toBe(false);
    expect(h.selection.message).toContain("предел 20 000 фрагментов");
    expect(h.selection.message).toContain("Выделите штрихи целиком");
    expect(h.selection.selected).toEqual(selected);
    expect(h.selection.outline).toEqual(area);
    expect(h.scene.strokes).toEqual(originals);
    expect(h.history.canRedo).toBe(true);
    h.selection.copy();
    expect(h.selection.hasClipboard).toBe(true);
    h.selection.remove(true);
    expect(validate).toHaveBeenCalledOnce();
    expect(h.commits()).toBe(1);
    expect(h.scene.strokes).toHaveLength(20000);
  });

  it("allows moving whole strokes at the same count limit", () => {
    const dots = Array.from({ length: 20000 }, (_, i) => ({
      ...ink(i + 1),
      points: [
        { x: i % 200, y: 50 + Math.floor(i / 200), time: 0, pressure: 1 },
      ],
    }));

    const validate = vi.fn(),
      h = harness(dots, true, { validate });

    h.selection.all();
    h.selection.down(pointer(30, 50));
    h.selection.up(pointer(40, 60, { buttons: 0 }));
    expect(validate).toHaveBeenCalledOnce();
    expect(h.commits()).toBe(1);
    expect(h.scene.strokes).toHaveLength(20000);
    expect(h.selection.selected[0]!.translation).toEqual({ x: 10, y: 10 });
    expect(h.selection.message).toBe("");
  });
});
