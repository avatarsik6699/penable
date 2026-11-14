import type { HistoryState, HistoryAction } from "~/entities/board";
import type { EditorCommandTypes } from "./editor-commands.types";

function create(options: EditorCommandTypes.HistoryOptions) {
  const {
    history,
    drawingPointerId,
    navigation,
    selection,
    canWrite,
    interactionsBlocked,
    renderer,
    onDocumentChange,
    onHistoryState,
    active,
  } = options;

  let previousHistory: HistoryState | null = null;

  const publishHistoryState = () => {
    if (!active()) return;

    const next = {
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      busy:
        drawingPointerId() !== null ||
        navigation.pointerId !== null ||
        selection.busy ||
        Boolean(options.additionalBusy?.()),
    };

    const previous = previousHistory;

    if (
      previous &&
      previous.canUndo === next.canUndo &&
      previous.canRedo === next.canRedo &&
      previous.busy === next.busy
    )
      return;

    previousHistory = next;
    onHistoryState(next);
  };

  const applyHistory = (action: HistoryAction) => {
    if (
      !canWrite() ||
      interactionsBlocked() ||
      options.touchBusy?.() ||
      drawingPointerId() !== null ||
      navigation.pointerId !== null ||
      selection.busy
    )
      return;

    if (action === "undo" ? history.undo() : history.redo()) {
      selection.clear();
      renderer.sceneChanged();
      publishHistoryState();
      onDocumentChange(true);
    }
  };

  return { publish: publishHistoryState, apply: applyHistory };
}

export const HistoryCommands = { create };
