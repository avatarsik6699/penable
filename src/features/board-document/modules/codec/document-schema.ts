import type { BoardItem } from "~/entities/board";
import type { BoardDocument, StoredRecord } from "../../board-document.types";

function current(items: readonly BoardItem[]): 5 | 6 {
  return items.some((item) => item.kind === "text") ? 6 : 5;
}

function itemDocument(value: unknown): value is 4 | 5 | 6 {
  return value === 4 || value === 5 || value === 6;
}

function version(value: unknown): unknown {
  return value && typeof value === "object" && "schemaVersion" in value
    ? value.schemaVersion
    : undefined;
}

function upgradeBackups(
  target: BoardDocument["schemaVersion"],
  previous: StoredRecord,
) {
  const prior = version(previous.value);

  return {
    beforeSchema4:
      previous.exists && target >= 4 && [1, 2, 3].includes(prior as number),
    beforeSchema5:
      previous.exists && target >= 5 && [1, 2, 3, 4].includes(prior as number),
    beforeSchema6: previous.exists && target === 6 && prior !== 6,
  };
}

export const DocumentSchema = {
  current,
  itemDocument,
  version,
  upgradeBackups,
};
