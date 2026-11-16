import { BoardShortcuts } from "~/entities/board";
import type { SelectionCommand } from "../../../../model/workspace-model.types";
import type {
  BindingOptions,
  InteractionState,
} from "./surface-bindings.types";
import type { CursorBinding } from "./cursor-binding";
import type { PointerBinding } from "./pointer-binding";

function create(
  options: Pick<
    BindingOptions,
    | "canvas"
    | "navigation"
    | "selection"
    | "getTool"
    | "interactionsBlocked"
    | "inputBusy"
    | "preservePendingInsertion"
    | "cancelPendingInput"
    | "drawingPointerId"
    | "selectionCommand"
    | "applyHistory"
  >,
  interaction: InteractionState,
  cursor: ReturnType<typeof CursorBinding.create>,
  pointer: ReturnType<typeof PointerBinding.create>,
) {
  const {
    canvas,
    navigation,
    selection,
    getTool,
    interactionsBlocked,
    drawingPointerId,
    selectionCommand,
    applyHistory,
  } = options;

  const keyDown = (event: KeyboardEvent) => {
    if (event.code === "Tab") interaction.keyboardEntry = true;

    const target = event.target instanceof HTMLElement ? event.target : null;

    const editable = Boolean(
      target?.closest("input,textarea,select,[contenteditable],dialog"),
    );

    if (
      event.code === "Escape" &&
      !editable &&
      !event.defaultPrevented &&
      !event.isComposing &&
      options.cancelPendingInput?.()
    ) {
      event.preventDefault();
      pointer.cancel();

      return;
    }

    if (interactionsBlocked() || options.inputBusy?.()) return;

    const boardContext = Boolean(
      target === canvas || target?.closest("[data-board-selection-toolbar]"),
    );

    if (
      boardContext &&
      !editable &&
      !event.altKey &&
      !event.isComposing &&
      !event.defaultPrevented
    ) {
      const modifier = event.ctrlKey || event.metaKey;

      const commands: Record<string, SelectionCommand> = {
        KeyA: "all",
        KeyD: "duplicate",
      };

      const command = modifier
        ? commands[event.code]
        : event.code === "Escape"
          ? "clear"
          : ["Delete", "Backspace"].includes(event.code)
            ? "delete"
            : undefined;

      if (command) {
        event.preventDefault();

        if (
          command === "clear" &&
          (drawingPointerId() !== null ||
            navigation.pointerId !== null ||
            pointer.touchActive())
        )
          pointer.cancel();
        else selectionCommand(command);

        cursor.update();

        return;
      }

      const nudge = BoardShortcuts.selectionNudgeShortcut(event, {
        editable,
        inkPointerId: drawingPointerId(),
        panPointerId: navigation.pointerId,
      });

      if (nudge && getTool() === "selection" && selection.hasSelection) {
        event.preventDefault();

        if (!nudge.blocked && !pointer.touchActive())
          selection.nudge(nudge.x, nudge.y);

        return;
      }
    }

    const shortcut = BoardShortcuts.historyShortcut(event, {
      editable: Boolean(
        target?.closest('input:not([type="range"]),textarea,select') ||
        target?.isContentEditable,
      ),
      inkPointerId: drawingPointerId(),
      panPointerId: navigation.pointerId,
    });

    if (shortcut) {
      event.preventDefault();

      if (!shortcut.blocked) applyHistory(shortcut.action);

      return;
    }

    if (
      event.code !== "Space" ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return;

    if (
      target?.closest(
        'input:not([type="range"]),textarea,select,[contenteditable]',
      )
    )
      return;

    if (!target?.closest('button,summary,input[type="range"]'))
      event.preventDefault();

    interaction.spaceDown = true;
    cursor.update();
  };

  const keyUp = (event: KeyboardEvent) => {
    if (event.code.startsWith("Arrow")) selection.finishNudge();

    if (event.code !== "Space") return;

    interaction.spaceDown = false;
    cursor.update();
  };

  const blur = () => {
    interaction.focused = false;
    interaction.spaceDown = false;

    if (options.preservePendingInsertion?.() && !interactionsBlocked())
      pointer.cancelGestures();
    else pointer.cancel();
  };

  const focus = () => {
    interaction.focused = true;
    cursor.refresh();
  };

  const visibility = () => {
    if (document.visibilityState === "hidden") blur();
    else focus();
  };

  return { keyDown, keyUp, blur, focus, visibility };
}

export const KeyboardBinding = { create };
