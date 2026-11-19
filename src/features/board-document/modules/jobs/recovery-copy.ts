import { RecoveryCopyProjection } from "./recovery-copy.utils";
import { Messages } from "~/shared/lib/messages";
import { DocumentCodec } from "../codec";
import type { StoredRecord } from "../../board-document.types";
import type { SerializedRecordCopy } from "../record-copies";

function stringify(value: unknown): string {
  const projection = RecoveryCopyProjection.project(value);

  return DocumentCodec.serializeRawBackup(
    projection.value,
    projection.identities,
  );
}

function serialize(record: StoredRecord): SerializedRecordCopy {
  if (!record.exists) return { exists: false };

  const value = record.value;

  const version = RecoveryCopyProjection.schemaVersion(value);

  const copy: SerializedRecordCopy = {
    exists: true,
    ...(typeof version === "string" ||
    typeof version === "number" ||
    typeof version === "boolean" ||
    version === null
      ? { schemaVersion: version }
      : {}),
  };

  try {
    copy.blob = new Blob([stringify(value)], { type: "application/json" });
  } catch (error) {
    copy.error = Messages.from(error);
  }

  return copy;
}

export const RecoveryCopy = { serialize, stringify };
