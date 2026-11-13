import { describe, expect, it } from "vitest";
import { BoardShortcuts } from "./shortcuts";
type KeyEvent = Parameters<typeof BoardShortcuts.historyShortcut>[0];
const idle = { editable: false, inkPointerId: null, panPointerId: null };
function keyEvent(overrides: Partial<KeyEvent> = {}): KeyEvent {
  return {
    code: "KeyZ",
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  };
}
describe("history keyboard intent", () => {
  it.each([
    [true, false, false, "undo"],
    [true, false, true, "redo"],
    [false, true, false, "undo"],
    [false, true, true, "redo"],
  ] as const)(
    "recognizes ctrl %s / meta %s / shift %s as %s",
    (ctrlKey, metaKey, shiftKey, action) => {
      expect(
        BoardShortcuts.historyShortcut(
          keyEvent({ ctrlKey, metaKey, shiftKey }),
          idle,
        ),
      ).toEqual({ action, blocked: false });
    },
  );
  it("uses physical KeyZ independently of the character produced by the layout", () => {
    const event = { ...keyEvent(), key: "я" };
    expect(BoardShortcuts.historyShortcut(event, idle)?.action).toBe("undo");
    expect(
      BoardShortcuts.historyShortcut(keyEvent({ code: "KeyY" }), idle),
    ).toBeNull();
  });
  it.each([
    { ctrlKey: false },
    { altKey: true },
    { isComposing: true },
    { defaultPrevented: true },
  ])("ignores unrecognized or protected keyboard event %j", (overrides) => {
    expect(
      BoardShortcuts.historyShortcut(keyEvent(overrides), idle),
    ).toBeNull();
  });
  it("leaves native undo and redo in editable controls untouched", () => {
    expect(
      BoardShortcuts.historyShortcut(keyEvent(), { ...idle, editable: true }),
    ).toBeNull();
    expect(
      BoardShortcuts.historyShortcut(keyEvent({ shiftKey: true }), {
        ...idle,
        editable: true,
      }),
    ).toBeNull();
  });
  it.each([
    { inkPointerId: 0, panPointerId: null },
    { inkPointerId: null, panPointerId: 2 },
    { inkPointerId: 1, panPointerId: 2 },
  ])(
    "recognizes but blocks history during the actual active contact %j",
    (pointers) => {
      expect(
        BoardShortcuts.historyShortcut(keyEvent(), { ...idle, ...pointers }),
      ).toEqual({ action: "undo", blocked: true });
      expect(
        BoardShortcuts.historyShortcut(keyEvent({ shiftKey: true }), {
          ...idle,
          ...pointers,
        }),
      ).toEqual({ action: "redo", blocked: true });
    },
  );
});
describe("selection nudge ownership", () => {
  it.each([
    { inkPointerId: 0, panPointerId: null },
    { inkPointerId: null, panPointerId: 1 },
    { inkPointerId: 2, panPointerId: null },
  ])("blocks nudge during a synchronous input/pan owner %j", (pointers) => {
    expect(
      BoardShortcuts.selectionNudgeShortcut(
        keyEvent({ code: "ArrowRight", ctrlKey: false }),
        { ...idle, ...pointers },
      ),
    ).toEqual({ x: 1, y: 0, blocked: true });
  });
  it("permits autorepeated nudges with no pointer owner and honors Shift CSS steps", () => {
    const key = keyEvent({ code: "ArrowUp", ctrlKey: false });
    expect(BoardShortcuts.selectionNudgeShortcut(key, idle)).toEqual({
      x: 0,
      y: -1,
      blocked: false,
    });
    expect(
      BoardShortcuts.selectionNudgeShortcut(
        { ...key, repeat: true } as typeof key,
        idle,
      ),
    ).toEqual({ x: 0, y: -1, blocked: false });
    expect(
      BoardShortcuts.selectionNudgeShortcut({ ...key, shiftKey: true }, idle),
    ).toEqual({ x: 0, y: -10, blocked: false });
  });
  it("leaves editable controls and modified arrow shortcuts untouched", () => {
    expect(
      BoardShortcuts.selectionNudgeShortcut(
        keyEvent({ code: "ArrowLeft", ctrlKey: false }),
        { ...idle, editable: true },
      ),
    ).toBeNull();
    expect(
      BoardShortcuts.selectionNudgeShortcut(
        keyEvent({ code: "ArrowRight" }),
        idle,
      ),
    ).toBeNull();
  });
});
