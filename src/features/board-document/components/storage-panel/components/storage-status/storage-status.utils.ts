import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { StorageState } from "../../../../board-document.types";
import { StorageStatusConfig } from "./storage-status.config";

function label(state: StorageState, recovering = false): MessageTypes.Value {
  if (state.phase === "error")
    return recovering
      ? Messages.create("couldNotOpenTheBoard")
      : StorageStatusConfig.labels.error;

  if (state.phase === "loading") return StorageStatusConfig.labels.loading;

  if (state.readOnly && state.loaded) return Messages.create("readOnly");

  return StorageStatusConfig.labels[state.phase];
}

export const StorageStatusPresentation = { label };
