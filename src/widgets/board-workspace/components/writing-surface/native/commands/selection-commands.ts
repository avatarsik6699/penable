import type { SelectionCommand } from "../../../../model/workspace-model.types";
import { BoardPNG } from "../rendering";
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
    publishSelection,
  } = options;

  let disposed = false,
    pngBusy = false,
    pngGeneration = 0;

  let pngBlob: Blob | null = null;

  const command = (command: SelectionCommand) => {
    if (
      interactionsBlocked() ||
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

    if (selection.busy) return;

    if (["all", "paste", "duplicate"].includes(command)) onActivateSelection();

    if (command === "all") selection.all();

    if (command === "copy") selection.copy();

    if (command === "cut") selection.remove(true);

    if (command === "delete") selection.remove();

    if (command === "paste") selection.insert();

    if (command === "crop") selection.cropImages();

    if (command === "paste-image") options.pasteImage?.();

    if (command === "duplicate") selection.insert(true);

    if (command === "download" && pngBlob) BoardPNG.downloadPNG(pngBlob);

    if (command === "image" && selection.hasSelection && !pngBusy) {
      pngBusy = true;
      publishSelection();

      const generation = ++pngGeneration;

      const promise = BoardPNG.selectionPNG(
        selection.selected,
        selection.outline,
        options.images,
      );

      // Invoke the clipboard API in the user gesture, passing a deferred PNG Blob.
      const clipboard = BoardPNG.writePNG(promise);

      void Promise.allSettled([promise, clipboard]).then(
        ([result, written]) => {
          if (disposed || generation !== pngGeneration) return;

          pngBusy = false;

          if (result.status === "fulfilled") pngBlob = result.value;

          selection.message =
            result.status === "rejected"
              ? String(
                  result.reason instanceof Error
                    ? result.reason.message
                    : result.reason,
                )
              : written.status === "fulfilled"
                ? "PNG передан в системный буфер."
                : "Не удалось записать PNG в системный буфер. Откройте «Действия» → «Скачать PNG».";

          publishSelection();
        },
      );
    }
  };

  return {
    command,
    get busy() {
      return pngBusy;
    },
    get hasPNG() {
      return pngBlob !== null;
    },

    dispose() {
      disposed = true;
      pngGeneration++;
    },
  };
}

export const SelectionCommands = { create };
