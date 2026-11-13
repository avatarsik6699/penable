import { describe, expect, it, vi } from "vitest";
import { serialize } from "node:v8";
import { StrokeHistory } from "./history";
import { PenInput } from "./input";
import {
  type PointerInput,
  type Scene,
  type Stroke,
  BoardConstants,
} from "./types";
import { BoardViewport } from "./viewport";

function stroke(id: number): Stroke {
  return {
    id,
    color: BoardConstants.INK,
    width: 0.7,
    points: [{ x: id, y: 2, pressure: 0.6, time: id }],
    stabilization: { strength: 65, captureZoom: 2 },
  };
}

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return {
    pointerId: 1,
    pointerType: "pen",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 10,
    clientY: 20,
    pressure: 0.5,
    timeStamp: 1,
    ...overrides,
  };
}

describe("completed stroke history", () => {
  it("keeps restored strokes below the undo floor and only undoes actions from this session", () => {
    const restored = stroke(10);
    const current = stroke(11);
    const history = new StrokeHistory([restored], 1);

    expect(history.canUndo).toBe(false);
    expect(history.undo()).toBe(false);
    history.commit(current);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(false);
    expect(history.strokes[0]).toBe(restored);
    expect(history.redo()).toBe(true);
    expect(history.strokes[1]).toBe(current);
  });

  it("starts empty and leaves the same completed array unchanged for empty operations", () => {
    const history = new StrokeHistory();
    const completed = history.strokes;

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);
    expect(history.undo()).toBe(false);
    expect(history.redo()).toBe(false);
    expect(history.strokes).toBe(completed);
    expect(completed).toEqual([]);
  });

  it("undoes in reverse order and redoes in original order using the exact objects and metadata", () => {
    const a = stroke(1);
    const b = stroke(2);
    const c = stroke(3);

    b.stabilization = { mode: "strong", captureZoom: 4 };
    delete c.stabilization;

    const originalPoints = a.points;
    const originalProfile = a.stabilization;

    for (const ink of [a, b, c]) {
      Object.freeze(ink.points[0]);
      Object.freeze(ink.points);
      Object.freeze(ink);
    }

    const completed = [a, b, c];
    const history = new StrokeHistory(completed);

    expect(history.strokes).toBe(completed);
    expect(history.undo()).toBe(true);
    expect(history.undo()).toBe(true);
    expect(history.strokes).toEqual([a]);
    expect(history.redo()).toBe(true);
    expect(history.strokes[1]).toBe(b);
    expect(history.redo()).toBe(true);
    expect(history.strokes[2]).toBe(c);
    history.undo();
    history.undo();
    history.undo();
    expect(history.canUndo).toBe(false);
    history.redo();
    expect(history.strokes[0]).toBe(a);
    expect(history.strokes[0]?.points).toBe(originalPoints);
    expect(history.strokes[0]?.stabilization).toBe(originalProfile);
    expect(history.strokes[0]?.width).toBe(0.7);
  });

  it("clears redo only when a new stroke is committed and appends that same object", () => {
    const history = new StrokeHistory();
    const a = stroke(1);
    const b = stroke(2);
    const replacement = stroke(3);

    history.commit(a);
    history.commit(b);
    history.undo();
    expect(history.canRedo).toBe(true);
    history.commit(replacement);
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBe(false);
    expect(history.strokes).toEqual([a, replacement]);
    expect(history.strokes[1]).toBe(replacement);
  });

  it("keeps redo through cancelled input; completion is the single history boundary", () => {
    const scene: Scene = { strokes: [], active: null };
    const history = new StrokeHistory(scene.strokes);
    const original = stroke(1);

    history.commit(original);
    history.undo();

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      width: () => 1.2,
      stabilization: () => 72,
      onActiveChange: vi.fn(),
      onCommit: (ink) => history.commit(ink),
    });

    input.down(pointer());
    input.move(pointer({ clientX: 20, timeStamp: 2 }));
    input.cancel();
    expect(history.canRedo).toBe(true);
    expect(history.strokes).toEqual([]);
    history.redo();
    expect(history.strokes[0]).toBe(original);
    history.undo();
    input.down(pointer({ timeStamp: 3 }));

    const active = scene.active;

    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 4 }));
    expect(history.canRedo).toBe(false);
    expect(history.strokes[0]).toBe(active);
    expect(scene.active).toBeNull();
  });
});

describe("mixed add and grouped erase history", () => {
  it("restores loaded and newly written objects at their exact original positions", () => {
    const [a, b, c, d, e] = [1, 2, 3, 4, 5].map(stroke) as [
      Stroke,
      Stroke,
      Stroke,
      Stroke,
      Stroke,
    ];

    const history = new StrokeHistory([a, b, c], 3);

    history.commit(d);
    expect(history.erase(new Set([a, c, d]))).toBe(true);
    expect(history.strokes).toEqual([b]);
    expect(history.undo()).toBe(true);

    for (const [index, original] of [a, b, c, d].entries())
      expect(history.strokes[index]).toBe(original);

    expect(history.undo()).toBe(true);
    expect(history.strokes).toEqual([a, b, c]);
    expect(history.undo()).toBe(false);
    history.redo();
    history.redo();
    expect(history.strokes).toEqual([b]);
    history.commit(e);
    expect(history.erase(new Set([b, e]))).toBe(true);
    expect(history.strokes).toEqual([]);
    history.undo();
    expect(history.strokes[0]).toBe(b);
    expect(history.strokes[1]).toBe(e);
  });

  it("keeps redo for empty/missing-object erases, and clears it for a real erase", () => {
    const a = stroke(1);
    const b = stroke(2);
    const history = new StrokeHistory([a], 1);

    history.commit(b);
    history.undo();
    expect(history.erase(new Set())).toBe(false);
    expect(history.erase(new Set([stroke(1)]))).toBe(false);
    expect(history.canRedo).toBe(true);
    expect(history.erase(new Set([a]))).toBe(true);
    expect(history.canRedo).toBe(false);
    history.undo();
    expect(history.strokes[0]).toBe(a);
    expect(history.undo()).toBe(false);
  });

  it("uses identity when an erased ID is allocated again", () => {
    const old = stroke(1);
    const replacement = stroke(1);
    const history = new StrokeHistory([old], 1);

    history.erase(new Set([old]));
    history.commit(replacement);
    history.erase(new Set([old]));
    expect(history.strokes[0]).toBe(replacement);
    history.undo();
    history.undo();
    expect(history.strokes[0]).toBe(old);
    history.redo();
    history.redo();
    expect(history.strokes[0]).toBe(replacement);
  });
});

describe("large ordered scene edits", () => {
  it("replaces and replays a large permutation without scanning or splicing per item", () => {
    const original = Array.from({ length: 20000 }, (_, index) =>
        stroke(index + 1),
      ),
      scene = [...original];

    const history = new StrokeHistory(scene, scene.length),
      candidate = [...original].reverse();

    const scan = vi.spyOn(scene, "indexOf"),
      splice = vi.spyOn(scene, "splice");

    expect(history.replace(candidate)).toBe(true);
    expect(history.strokes).toBe(scene);
    expect(scene[0]).toBe(original.at(-1));
    expect(scene.at(-1)).toBe(original[0]);
    history.undo();
    expect(scene[0]).toBe(original[0]);
    expect(scene.at(-1)).toBe(original.at(-1));
    history.redo();
    expect(scene[0]).toBe(candidate[0]);
    expect(scene.at(-1)).toBe(candidate.at(-1));
    expect(scan).not.toHaveBeenCalled();
    expect(splice).not.toHaveBeenCalled();
    scan.mockRestore();
    splice.mockRestore();
  });
});

describe("compact replacement history", () => {
  it("preserves same-length sparse updates, equal IDs and duplicate references in exact order", () => {
    const a = stroke(1),
      b = stroke(2),
      c = stroke(3),
      d = stroke(4);

    const aMoved = { ...a, translation: { x: 10, y: 20 } };

    const initial = [a, b, b, c, d, a],
      scene = [...initial];

    const history = new StrokeHistory(scene, scene.length);
    const candidate = [aMoved, b, b, c, d, aMoved];

    history.replace(candidate);
    expect(scene).toEqual(candidate);
    expect(scene[0]).toBe(aMoved);
    expect(scene[5]).toBe(aMoved);
    history.undo();
    expect(scene).toEqual(initial);
    expect(scene[0]).toBe(a);
    expect(scene[5]).toBe(a);
    history.redo();
    expect(scene).toEqual(candidate);
    expect(history.strokes).toBe(scene);
  });

  it("roundtrips changing lengths, shared tails, full deletions and insertion into an empty scene", () => {
    const items = Array.from({ length: 10 }, (_, index) => stroke(index + 1));

    const scene = [...items],
      history = new StrokeHistory(scene, scene.length);

    const states = [
      items,
      [items[0]!, items[1]!, stroke(11), ...items.slice(2)],
      [items[0]!, items[8]!, items[9]!],
      [],
      [items[9]!, items[9]!, items[0]!],
      [items[0]!, ...items, items[0]!],
    ];

    for (const state of states.slice(1)) {
      expect(history.replace(state)).toBe(true);
      expect(scene).toEqual(state);
    }

    for (let index = states.length - 2; index >= 0; index--) {
      expect(history.undo()).toBe(true);
      expect(scene).toEqual(states[index]);

      states[index]!.forEach((item, position) =>
        expect(scene[position]).toBe(item),
      );
    }

    expect(history.undo()).toBe(false);

    for (const state of states.slice(1)) {
      expect(history.redo()).toBe(true);
      expect(scene).toEqual(state);
    }

    expect(history.strokes).toBe(scene);
  });

  it("preserves redo on identical replacements and clears it only for a real mixed edit", () => {
    const a = stroke(1),
      b = stroke(2),
      c = stroke(3);

    const scene = [a, b],
      history = new StrokeHistory(scene, scene.length);

    history.replace([b, a]);
    history.undo();
    expect(history.replace([a, b])).toBe(false);
    expect(history.replace(scene)).toBe(false);
    expect(history.canRedo).toBe(true);
    history.commit(c);
    expect(history.canRedo).toBe(false);
    history.erase(new Set([b]));
    history.replace([c, a]);
    history.undo();
    expect(scene).toEqual([a, c]);
    history.undo();
    expect(scene).toEqual([a, b, c]);
    history.undo();
    expect(scene).toEqual([a, b]);
    expect(history.undo()).toBe(false);
    history.redo();
    history.redo();
    history.redo();
    expect(scene).toEqual([c, a]);
  });

  it("roundtrips deterministic mixed permutations and length changes with duplicate identities", () => {
    const pool = Array.from({ length: 12 }, (_, index) => stroke(index + 1));

    const scene = pool.slice(0, 8),
      history = new StrokeHistory(scene, scene.length);

    const states = [[...scene]];
    let seed = 1234567;

    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;

      return seed;
    };

    for (let step = 0; step < 200; step++) {
      const candidate = Array.from(
        { length: random() % 40 },
        () => pool[random() % pool.length]!,
      );

      if (history.replace(candidate)) states.push([...candidate]);

      expect(scene).toEqual(candidate);
    }

    for (let index = states.length - 2; index >= 0; index--) {
      expect(history.undo()).toBe(true);
      expect(scene).toEqual(states[index]);

      states[index]!.forEach((item, position) =>
        expect(scene[position]).toBe(item),
      );
    }

    expect(history.undo()).toBe(false);

    for (const state of states.slice(1)) {
      expect(history.redo()).toBe(true);
      expect(scene).toEqual(state);
      state.forEach((item, position) => expect(scene[position]).toBe(item));
    }
  });

  it("does not rewrite untouched members while applying a sparse edit or its undo/redo", () => {
    const raw = Array.from({ length: 20000 }, (_, index) => stroke(index + 1));
    let writes = 0;

    const scene = new Proxy(raw, {
      set(target, key, value, receiver) {
        if (typeof key === "string" && /^\d+$/.test(key)) writes++;

        return Reflect.set(target, key, value, receiver);
      },
    });

    const history = new StrokeHistory(scene, scene.length);
    const candidate = [...raw];

    candidate[1] = { ...candidate[1]!, translation: { x: 3, y: 4 } };
    candidate[19998] = { ...candidate[19998]!, translation: { x: 3, y: 4 } };
    history.replace(candidate);
    expect(writes).toBe(2);
    history.undo();
    expect(writes).toBe(4);
    history.redo();
    expect(writes).toBe(6);
    expect(scene).toEqual(candidate);
  });

  it("retains only edited members across many small changes on a large loaded scene", () => {
    const scene = Array.from({ length: 20000 }, (_, index) =>
      stroke(index + 1),
    );

    const history = new StrokeHistory(scene, scene.length);
    // V8's retained object graph is deterministic here and includes private history
    // payloads without adding a production-only inspection API or a wall-time budget.
    const initialBytes = serialize(history).byteLength;

    for (let index = 0; index < 500; index++) {
      const candidate = [...scene];

      candidate[100] = {
        ...candidate[100]!,
        translation: { x: index + 1, y: 0 },
      };

      history.replace(candidate);
    }

    expect(serialize(history).byteLength - initialBytes).toBeLessThan(200000);

    for (let index = 0; index < 500; index++) expect(history.undo()).toBe(true);

    expect(scene[100]?.translation).toBeUndefined();
    expect(history.undo()).toBe(false);

    for (let index = 0; index < 500; index++) expect(history.redo()).toBe(true);

    expect(scene[100]?.translation).toEqual({ x: 500, y: 0 });
  });

  it("handles a very large insertion without variadic splice/argument limits", () => {
    const original = [stroke(1), stroke(2)],
      scene = [...original];

    const history = new StrokeHistory(scene, scene.length);

    const inserted = Array.from({ length: 150000 }, (_, index) =>
      stroke(index + 3),
    );

    const candidate = [original[0]!, ...inserted, original[1]!];

    history.replace(candidate);
    expect(scene.length).toBe(candidate.length);
    expect(scene.at(-1)).toBe(original[1]);
    history.undo();
    expect(scene).toEqual(original);
    history.redo();
    expect(scene.length).toBe(candidate.length);
    expect(scene[1]).toBe(inserted[0]);
    expect(scene.at(-2)).toBe(inserted.at(-1));
  });
});
