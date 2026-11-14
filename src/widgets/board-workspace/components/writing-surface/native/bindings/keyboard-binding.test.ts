import { afterEach, describe, it, expect, vi } from "vitest";
import { KeyboardBinding } from "./keyboard-binding";

afterEach(() => vi.unstubAllGlobals());

describe("pending image Escape ownership", () => {
  it.each([false, true])(
    "cancels a pending decode from canvas and preserves native editable ownership %s",
    (editable) => {
      class NativeElement {
        closest = () => (editable ? {} : null);
      }

      vi.stubGlobal("HTMLElement", NativeElement);

      const target = new NativeElement(),
        cancelPendingInput = vi.fn(() => true),
        cancel = vi.fn(),
        preventDefault = vi.fn();

      const options = {
        canvas: target,
        interactionsBlocked: () => true,
        cancelPendingInput,
      } as unknown as Parameters<typeof KeyboardBinding.create>[0];

      const keyboard = KeyboardBinding.create(
        options,
        { spaceDown: false, focused: true, keyboardEntry: false },
        {} as Parameters<typeof KeyboardBinding.create>[2],
        { cancel } as unknown as Parameters<typeof KeyboardBinding.create>[3],
      );

      keyboard.keyDown({
        code: "Escape",
        target,
        defaultPrevented: false,
        isComposing: false,
        preventDefault,
      } as unknown as KeyboardEvent);

      expect(cancelPendingInput).toHaveBeenCalledTimes(editable ? 0 : 1);
      expect(cancel).toHaveBeenCalledTimes(editable ? 0 : 1);
      expect(preventDefault).toHaveBeenCalledTimes(editable ? 0 : 1);
    },
  );
});

describe("touch navigation keyboard ownership", () => {
  it("consumes selection arrows during touch navigation without mutating selection history", () => {
    class NativeElement {
      closest = () => null;
    }

    vi.stubGlobal("HTMLElement", NativeElement);

    const canvas = new NativeElement(),
      nudge = vi.fn(),
      preventDefault = vi.fn();

    let touching = true;

    const keyboard = KeyboardBinding.create(
      {
        canvas,
        navigation: { pointerId: null },
        selection: { hasSelection: true, nudge },
        getTool: () => "selection",
        interactionsBlocked: () => false,
        drawingPointerId: () => null,
      } as unknown as Parameters<typeof KeyboardBinding.create>[0],
      { spaceDown: false, focused: true, keyboardEntry: false },
      {} as Parameters<typeof KeyboardBinding.create>[2],
      { touchActive: () => touching } as Parameters<
        typeof KeyboardBinding.create
      >[3],
    );

    const event = {
      code: "ArrowRight",
      target: canvas,
      defaultPrevented: false,
      preventDefault,
    } as unknown as KeyboardEvent;

    keyboard.keyDown(event);
    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(nudge).not.toHaveBeenCalled();
    touching = false;
    keyboard.keyDown(event);
    expect(nudge).toHaveBeenCalledWith(1, 0);
  });
});
