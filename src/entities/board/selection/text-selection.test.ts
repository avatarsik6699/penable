import { describe, expect, it, vi } from "vitest";
import { Messages } from "~/shared/lib/messages";
import type { BoardItem, PointerInput, Stroke, TextItem } from "../board.types";
import { BoardText } from "../board-text";
import { StrokeHistory } from "../history";
import { EraserInput } from "../input";
import { BoardRegions } from "../regions";
import { BoardSnapshots } from "../snapshots";
import { BoardSelection } from "./selection";

const text: TextItem = {
  id: 1,
  kind: "text",
  text: "First line\nSecond line",
  width: 80,
  lines: [0, 11],
  matrix: [1, 1, -1, 1, 100, 20],
};

const ink: Stroke = {
  id: 2,
  width: 2,
  color: "#182230",
  points: [{ x: 100, y: 60, pressure: 0.5, time: 1 }],
};

const edited = { text: "Edited\n", width: 100, lines: [0, 7] };
const surface = { left: 0, top: 0, width: 800, height: 600 };
const viewport = { x: 0, y: 0, zoom: 1 };

function pointer(x: number, y: number, pointerType = "mouse"): PointerInput {
  return {
    pointerId: 1,
    pointerType,
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: x,
    clientY: y,
    pressure: 0.5,
    timeStamp: 1,
  };
}

function setup(strokes: BoardItem[] = [text, ink]) {
  const scene = { strokes: [...strokes], active: null };
  const history = new StrokeHistory(scene.strokes, scene.strokes.length);
  const permission = { writable: true };

  const validate =
    vi.fn<(_items: BoardItem[], signal: AbortSignal) => void | Promise<void>>();

  const commit = vi.fn((strokes: BoardItem[]) => history.replace(strokes));

  const selection = new BoardSelection({
    scene,
    viewport: () => viewport,
    bounds: () => surface,
    writable: () => permission.writable,
    allowTouch: () => true,
    validate,
    commit,

    preview: () => {},

    changed: () => {},

    setViewport: () => {},
  });

  return { scene, selection, permission, history, validate, commit };
}

describe("editable text on the board", () => {
  it("validates visual line starts and preserves mandatory paragraph and Unicode boundaries", () => {
    const value = { text: "a😀b\n\n", width: 600, lines: [0, 1, 3, 5, 6] };

    expect(BoardText.validLayout(value)).toBe(true);

    expect(BoardText.validLayout({ ...value, lines: [0, 2, 5, 6] })).toBe(
      false,
    );

    expect(BoardText.validLayout({ ...value, lines: [0, 6] })).toBe(false);
    expect(BoardText.validLayout({ ...value, lines: [0, 5] })).toBe(false);
    expect(BoardText.validLayout({ ...value, width: 601 })).toBe(false);

    expect(
      BoardText.validLayout({ text: "abc", width: 50, lines: [0, 3] }),
    ).toBe(false);
  });

  it("selects the entire affine block only inside an enclosing region, respecting holes", () => {
    const full = BoardText.mask(text);

    const [hole] = BoardRegions.rectangle(
      { x: 98, y: 58 },
      { x: 102, y: 62 },
    )[0]!;

    expect(BoardRegions.selectParts([text], full, () => 9)).toEqual([
      { original: text, selected: text, remainder: null },
    ]);

    expect(
      BoardRegions.selectParts(
        [text],
        [[full[0]![0]!, [...hole!].reverse()]],
        () => 9,
      ),
    ).toEqual([]);

    expect(
      BoardRegions.selectParts(
        [text],
        BoardRegions.rectangle({ x: 40, y: 10 }, { x: 105, y: 100 }),
        () => 9,
      ),
    ).toEqual([]);
  });

  it("chooses the topmost actual text block on a tap and preserves ink drawn over it", () => {
    const upper = { ...text, id: 3, text: "Upper text\nSecond line" };
    const h = setup([text, upper, ink]);
    const tap = pointer(100, 60, "touch");

    h.selection.all();
    h.selection.down(tap);
    h.selection.up({ ...tap, clientX: 102, buttons: 0 });
    expect(h.selection.selectedText()).toBe(upper);
    expect(h.selection.outline).toEqual(BoardText.mask(upper));
    expect(h.commit).not.toHaveBeenCalled();
    expect(h.scene.strokes).toEqual([text, upper, ink]);

    h.selection.clear();

    const outside = pointer(48, 28);

    h.selection.down(outside);
    h.selection.up({ ...outside, buttons: 0 });
    expect(h.selection.hasSelection).toBe(false);

    const drag = pointer(100, 60);

    h.selection.down(drag);
    h.selection.move(pointer(120, 80));
    h.selection.up({ ...drag, buttons: 0 });
    expect(h.selection.hasSelection).toBe(false);
  });

  it("moves a mixed selection and keeps both text lines and scene order when copying and duplicating", () => {
    const h = setup();

    h.selection.all();
    expect(h.selection.selectedText()).toBeNull();
    h.selection.nudge(30, -10);
    h.selection.finishNudge();

    const moved = h.scene.strokes[0];

    expect(moved).toMatchObject({ ...text, matrix: [1, 1, -1, 1, 130, 10] });

    expect(h.scene.strokes[1]).toMatchObject({
      ...ink,
      translation: { x: 30, y: -10 },
    });

    h.selection.copy();
    h.selection.insert(true);

    expect(h.scene.strokes.map((item) => item.kind)).toEqual([
      "text",
      undefined,
      "text",
      undefined,
    ]);

    expect(h.scene.strokes[0]).toBe(moved);

    expect(h.scene.strokes[2]).toMatchObject({
      kind: "text",
      text: text.text,
      lines: text.lines,
    });

    expect(h.scene.strokes[2]?.id).not.toBe(moved?.id);
    h.selection.remove();
    expect(h.scene.strokes).toHaveLength(2);
  });

  it("commits one replacement in place, retains the matrix and updates the selection outline", async () => {
    const h = setup();
    const tap = pointer(100, 60);

    h.selection.down(tap);
    h.selection.up({ ...tap, buttons: 0 });

    expect(await h.selection.replaceText(text, edited)).toEqual({
      status: "committed",
    });

    const replacement = h.selection.selectedText()!;

    expect(replacement).toMatchObject({ ...text, ...edited });
    expect(replacement.matrix).toBe(text.matrix);
    expect(replacement.lines).not.toBe(edited.lines);
    expect(h.scene.strokes[1]).toBe(ink);
    expect(h.selection.outline).toEqual(BoardText.mask(replacement));
    expect(h.history.undo()).toBe(true);
    expect(h.history.canUndo).toBe(false);
    expect(h.scene.strokes[0]).toBe(text);
    expect(h.history.redo()).toBe(true);
    expect(h.scene.strokes[0]).toBe(replacement);
  });

  it.each(["readonly", "renewed scene", "cancelled"])(
    "guards an edit during validation when %s",
    async (change) => {
      const h = setup([text]);
      const owner = new AbortController();
      let finishValidation!: () => void;

      const validation = new Promise<void>((resolve) => {
        finishValidation = resolve;
      });

      h.selection.all();
      h.validate.mockReturnValueOnce(validation);

      const pending = h.selection.replaceText(text, edited, owner.signal);

      if (change === "readonly") h.permission.writable = false;
      else if (change === "renewed scene") h.scene.strokes[0] = { ...text };
      else owner.abort();

      finishValidation();

      const result = await pending;

      if (change === "cancelled")
        expect(result).toEqual({ status: "cancelled" });
      else
        expect(result).toEqual({
          status: "rejected",
          reason: Messages.create(
            change === "readonly"
              ? "boardIsReadOnly"
              : "theBoardChangedTryTheActionAgain",
          ),
        });

      expect(h.commit).not.toHaveBeenCalled();
    },
  );

  it("keeps text through erasure and detaches placement and line offsets when hydrating a snapshot", () => {
    const h = setup();

    const eraser = new EraserInput({
      scene: h.scene,
      viewport: () => viewport,
      bounds: () => surface,

      onPreviewChange: () => {},

      onCommit: (strokes) => h.history.erase(strokes),
    });

    const contact = pointer(100, 60);

    eraser.down(contact);
    eraser.up({ ...contact, buttons: 0 });
    expect(h.scene.strokes).toEqual([text]);

    const snapshot = { ...BoardSnapshots.empty(), strokes: h.scene.strokes };

    for (const item of [
      BoardSnapshots.clone(snapshot).strokes[0],
      BoardSnapshots.hydrateEditor(snapshot).strokes[0],
    ]) {
      expect(item).toEqual(text);
      expect(item?.matrix).not.toBe(text.matrix);
      expect(item?.kind === "text" && item.lines).not.toBe(text.lines);
    }
  });
});
