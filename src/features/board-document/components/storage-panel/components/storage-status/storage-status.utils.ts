import type { StorageState } from "../../../../board-document.types";
import { StorageStatusConfig } from "./storage-status.config";

function label(state: StorageState): string {
  if (state.phase === "error") return StorageStatusConfig.labels.error;

  if (state.phase === "loading") return StorageStatusConfig.labels.loading;

  if (state.readOnly && state.loaded) return "Только просмотр";

  return StorageStatusConfig.labels[state.phase];
}

export const StorageStatusPresentation = { label };
