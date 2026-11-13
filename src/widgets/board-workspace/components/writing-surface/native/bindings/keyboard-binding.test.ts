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
