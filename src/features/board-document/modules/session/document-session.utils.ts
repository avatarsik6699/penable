import type { StorageState } from "../../board-document.types";

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Неизвестная ошибка хранилища.";
}

function isSchema1(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1,
  );
}

function sameState(
  previous: StorageState | null,
  state: StorageState,
): boolean {
  return Boolean(
    previous &&
    previous.phase === state.phase &&
    previous.loaded === state.loaded &&
    previous.writable === state.writable &&
    previous.readOnly === state.readOnly &&
    previous.canImport === state.canImport &&
    previous.importing === state.importing &&
    previous.hasUpgradeCopy === state.hasUpgradeCopy &&
    previous.hasPrevious === state.hasPrevious &&
    previous.canReconnect === state.canReconnect &&
    previous.message === state.message,
  );
}

export const DocumentErrors = { messageOf };
export const SessionUtils = { isSchema1, sameState };
