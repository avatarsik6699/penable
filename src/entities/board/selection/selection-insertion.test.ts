import { describe, expect, it, vi } from "vitest";
import { Messages } from "~/shared/lib/messages";
import type { BoardItem, Scene } from "../board.types";
import { BoardLimits } from "../scene-limits";
import { BoardSelection } from "./selection";

const item: BoardItem = {
  kind: "image",
  id: 1,
  matrix: [1, 0, 0, 1, 0, 0],
  asset: { id: "image", mime: "image/png", base64: "", width: 10, height: 10 },
};

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function setup() {
  const scene: Scene = { strokes: [], active: null };
  const guards = { writable: true };

  const validate =
    vi.fn<(_items: BoardItem[], signal: AbortSignal) => void | Promise<void>>();

  const commit = vi.fn((items: BoardItem[]) => {
    scene.strokes = items;
  });

  const selection = new BoardSelection({
    scene,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    writable: () => guards.writable,
    validate,
    commit,
    preview: vi.fn(),
    changed: vi.fn(),
    setViewport: vi.fn(),
  });

  return { scene, guards, validate, commit, selection };
}

describe("selection insertion transaction results", () => {
  it("retains boolean APIs and returns explicit synchronous guard reasons", async () => {
    const h = setup();

    expect(await h.selection.insertItemsDetailed([])).toEqual({
      status: "rejected",
      reason: Messages.create("selectionAreaIsEmpty"),
    });

    h.guards.writable = false;

    expect(await h.selection.insertItemsDetailed([item])).toEqual({
      status: "rejected",
      reason: Messages.create("boardIsReadOnly"),
    });

    expect(await h.selection.insertItems([item])).toBe(false);
    h.guards.writable = true;

    const gate = deferred();

    h.validate.mockReturnValueOnce(gate.promise);

    const pending = h.selection.insertItemsDetailed([item]);

    expect(await h.selection.insertItemsDetailed([item])).toEqual({
      status: "rejected",
      reason: Messages.create("selectionIsBusy"),
    });

    gate.resolve();
    expect(await pending).toEqual({ status: "committed" });
    expect(await h.selection.insertItems([{ ...item, id: 2 }])).toBe(true);
    expect(h.commit).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    "preserves the exact validation rejection descriptor (async %s)",
    async (async) => {
      const h = setup();
      const reason = Messages.create("imageExceeds8Mib");

      h.validate.mockImplementation(() => {
        if (async) return Promise.reject(Messages.error(reason));

        throw Messages.error(reason);
      });

      const pending = h.selection.insertItemsDetailed([item]);

      h.selection.message = Messages.create("processingImage");
      expect(await pending).toEqual({ status: "rejected", reason });
      expect(h.commit).not.toHaveBeenCalled();
    },
  );

  it("reports the scene limit reason directly before validation", async () => {
    const h = setup();

    h.scene.strokes = Array<BoardItem>(BoardLimits.SCENE_LIMITS.strokes).fill(
      item,
    );

    const reason = Messages.concat(
      Messages.create("theBoardHasReachedTheLimitOf"),
      Messages.create("movingPartOfAStrokeCreatesExtra"),
    );

    expect(await h.selection.insertItemsDetailed([item])).toEqual({
      status: "rejected",
      reason,
    });

    expect(h.validate).not.toHaveBeenCalled();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it.each(["scene", "readonly"])(
    "rejects stale acceptance after %s changes",
    async (change) => {
      const h = setup();
      const gate = deferred();

      h.validate.mockReturnValueOnce(gate.promise);

      const pending = h.selection.insertItemsDetailed([item]);

      if (change === "scene") h.scene.strokes.push({ ...item, id: 10 });
      else h.guards.writable = false;

      gate.resolve();

      expect(await pending).toEqual({
        status: "rejected",
        reason: Messages.create(
          change === "scene"
            ? "theBoardChangedTryTheActionAgain"
            : "boardIsReadOnly",
        ),
      });

      expect(h.commit).not.toHaveBeenCalled();
    },
  );

  it("cancels the matching pending operation, settles promptly and ignores its late completion", async () => {
    const h = setup();
    const gate = deferred();
    const owner = new AbortController();

    h.validate.mockReturnValueOnce(gate.promise);

    const pending = h.selection.insertItemsDetailed([item], owner.signal);
    const signal = h.validate.mock.calls[0]![1];

    owner.abort();
    expect(signal.aborted).toBe(true);
    expect(await pending).toEqual({ status: "cancelled" });
    expect(h.selection.message).toBe("");
    expect(h.selection.busy).toBe(false);
    gate.resolve();
    await Promise.resolve();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it("ignores already aborted calls and old caller aborts after a newer operation starts", async () => {
    const h = setup();
    const aborted = new AbortController();

    aborted.abort();

    expect(
      await h.selection.insertItemsDetailed([item], aborted.signal),
    ).toEqual({ status: "cancelled" });

    expect(h.validate).not.toHaveBeenCalled();

    const previousOwner = new AbortController();

    expect(
      await h.selection.insertItemsDetailed([item], previousOwner.signal),
    ).toEqual({ status: "committed" });

    const gate = deferred();

    h.validate.mockReturnValueOnce(gate.promise);

    const current = h.selection.insertItemsDetailed([{ ...item, id: 2 }]);

    previousOwner.abort();
    expect(h.selection.busy).toBe(true);
    gate.resolve();
    expect(await current).toEqual({ status: "committed" });
    expect(h.commit).toHaveBeenCalledTimes(2);
  });

  it("does not publish pending status when caller cancellation occurs during preparation", async () => {
    const h = setup();
    const owner = new AbortController();
    const gate = deferred();

    h.validate.mockImplementation(() => {
      owner.abort();

      return gate.promise;
    });

    expect(await h.selection.insertItemsDetailed([item], owner.signal)).toEqual(
      { status: "cancelled" },
    );

    expect(h.selection.busy).toBe(false);
    expect(h.selection.message).toBe("");
    gate.reject(new Error("late cancelled validation"));
    await Promise.resolve();
    expect(h.commit).not.toHaveBeenCalled();
  });

  it("a cancelled caller cannot cancel a later operation when its old promise rejects", async () => {
    const h = setup();
    const firstGate = deferred();
    const secondGate = deferred();
    const owner = new AbortController();

    h.validate
      .mockReturnValueOnce(firstGate.promise)
      .mockReturnValueOnce(secondGate.promise);

    const first = h.selection.insertItemsDetailed([item], owner.signal);

    h.selection.cancel();
    expect(await first).toEqual({ status: "cancelled" });

    const second = h.selection.insertItemsDetailed([item]);

    owner.abort();
    firstGate.reject(new Error("late failure"));
    await Promise.resolve();
    expect(h.selection.busy).toBe(true);
    secondGate.resolve();
    expect(await second).toEqual({ status: "committed" });
    expect(h.commit).toHaveBeenCalledOnce();
  });
});
