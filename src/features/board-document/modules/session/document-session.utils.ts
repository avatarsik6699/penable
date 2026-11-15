import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { StorageState } from "../../board-document.types";

function messageOf(error: unknown): MessageTypes.Value {
  return error instanceof Error
    ? Messages.from(error)
    : Messages.create("unknownStorageError");
}

function isSchema1(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    value.schemaVersion === 1,
  );
}

function isLegacy(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    (value.schemaVersion === 1 || value.schemaVersion === 2),
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
    previous.hasSchema3Copy === state.hasSchema3Copy &&
    previous.hasSchema4Copy === state.hasSchema4Copy &&
    previous.hasLibraryCopy === state.hasLibraryCopy &&
    previous.hasRawCopy === state.hasRawCopy &&
    previous.hasPrevious === state.hasPrevious &&
    previous.canReconnect === state.canReconnect &&
    previous.message === state.message,
  );
}

export const DocumentErrors = { messageOf };

function isPre4(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "schemaVersion" in value &&
    [1, 2, 3].includes(value.schemaVersion as number),
  );
}

export const SessionUtils = { isSchema1, isLegacy, isPre4, sameState };
