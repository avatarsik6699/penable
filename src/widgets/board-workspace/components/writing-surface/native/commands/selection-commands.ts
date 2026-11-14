import type { SelectionCommand } from "../../../../model/workspace-model.types";
import type { EditorCommandTypes } from "./editor-commands.types";

function create(options: EditorCommandTypes.SelectionOptions) {
  const {
    selection,
    input,
    eraser,
    navigation,
    interactionsBlocked,
    cancel,
    onActivateSelection,
  } = options;

  const command = (command: SelectionCommand) => {
    if (
      interactionsBlocked() ||
      options.touchBusy?.() ||
      input.pointerId !== null ||
      eraser.pointerId !== null ||
      navigation.pointerId !== null
    )
      return;

    if (command === "clear") {
      if (selection.busy || options.pendingInput?.()) cancel();
      else selection.clear();

      return;
    }

    if (selection.busy || options.clipboard.busy) return;

    if (["all", "paste", "duplicate"].includes(command)) onActivateSelection();

    if (command === "all") selection.all();

    if (command === "copy") void options.clipboard.copy(false);

    if (command === "cut") void options.clipboard.copy(true);

    if (command === "delete") selection.remove();

    if (command === "paste") void options.clipboard.paste();

    if (command === "crop") selection.cropImages();

    if (command === "duplicate") selection.insert(true);

    if (command === "download") void options.clipboard.download();
  };

  return {
    command,
    get busy() {
      return options.clipboard.busy;
    },
    get hasPNG() {
      return selection.hasSelection;
    },

    dispose() {
      options.clipboard.dispose();
    },
  };
}

export const SelectionCommands = { create };
