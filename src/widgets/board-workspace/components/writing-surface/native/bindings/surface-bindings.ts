import type {
  BindingOptions,
  InteractionState,
} from "./surface-bindings.types";
import { CursorBinding } from "./cursor-binding";
import { PointerBinding } from "./pointer-binding";
import { KeyboardBinding } from "./keyboard-binding";
import { EdgePan } from "./edge-pan";

function bind(options: BindingOptions) {
  const { canvas } = options;

  const interaction: InteractionState = {
    spaceDown: false,
    focused: true,
    keyboardEntry: false,
  };

  const cursor = CursorBinding.create(options, interaction);
  const edge = EdgePan.create(options, cursor);
  const pointer = PointerBinding.create(options, interaction, cursor, edge);

  const keyboard = KeyboardBinding.create(
    options,
    interaction,
    cursor,
    pointer,
  );

  canvas.addEventListener("pointerenter", cursor.sample);
  canvas.addEventListener("pointerleave", cursor.leave);
  canvas.addEventListener("focus", cursor.focusCanvas);
  canvas.addEventListener("blur", cursor.blurCanvas);
  canvas.addEventListener("pointerdown", pointer.down);
  canvas.addEventListener("lostpointercapture", pointer.lostCapture);
  canvas.addEventListener("contextmenu", pointer.contextMenu);
  canvas.addEventListener("wheel", pointer.wheel, { passive: false });
  // Window listeners also handle releases outside the sheet when capture is unavailable.
  window.addEventListener("pointerover", cursor.over);
  window.addEventListener("focus", keyboard.focus);
  document.addEventListener("visibilitychange", keyboard.visibility);
  document.addEventListener("toggle", cursor.refresh, true);
  window.addEventListener("pointermove", pointer.move, { passive: false });
  window.addEventListener("pointerup", pointer.up, { passive: false });
  window.addEventListener("pointercancel", pointer.pointerCancel);
  window.addEventListener("blur", keyboard.blur);
  window.addEventListener("keydown", keyboard.keyDown);
  window.addEventListener("keyup", keyboard.keyUp);

  return {
    cancel: pointer.cancel,
    refresh: cursor.refresh,

    dispose() {
      canvas.removeEventListener("pointerenter", cursor.sample);
      canvas.removeEventListener("pointerleave", cursor.leave);
      canvas.removeEventListener("focus", cursor.focusCanvas);
      canvas.removeEventListener("blur", cursor.blurCanvas);
      canvas.removeEventListener("pointerdown", pointer.down);
      canvas.removeEventListener("lostpointercapture", pointer.lostCapture);
      canvas.removeEventListener("contextmenu", pointer.contextMenu);
      canvas.removeEventListener("wheel", pointer.wheel);
      window.removeEventListener("pointerover", cursor.over);
      window.removeEventListener("focus", keyboard.focus);
      document.removeEventListener("visibilitychange", keyboard.visibility);
      document.removeEventListener("toggle", cursor.refresh, true);
      window.removeEventListener("pointermove", pointer.move);
      window.removeEventListener("pointerup", pointer.up);
      window.removeEventListener("pointercancel", pointer.pointerCancel);
      window.removeEventListener("blur", keyboard.blur);
      window.removeEventListener("keydown", keyboard.keyDown);
      window.removeEventListener("keyup", keyboard.keyUp);

      pointer.cancel();
      edge.dispose();
      cursor.dispose();
    },
  };
}

export const SurfaceBindings = { bind };
