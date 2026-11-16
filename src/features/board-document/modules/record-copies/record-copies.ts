import { Messages } from "~/shared/lib/messages";
import type { StoredRecord } from "../../board-document.types";
import type { SerializedRecordCopy } from "./record-copies.types";

const copies = new WeakMap<object, SerializedRecordCopy>();

function capture(copy: SerializedRecordCopy): StoredRecord {
  if (!copy.exists) return { exists: false, value: undefined };

  const value = Object.freeze(
    Object.hasOwn(copy, "schemaVersion")
      ? { schemaVersion: copy.schemaVersion }
      : {},
  );

  copies.set(value, copy);

  return { exists: true, value };
}

function read(value: unknown): Blob | undefined {
  const copy =
    value && typeof value === "object" ? copies.get(value) : undefined;

  if (!copy) return undefined;

  if (copy.error) throw Messages.error(copy.error);

  if (!copy.blob)
    throw Messages.error(
      Messages.create("theOriginalRecordCannotBeRepresentedAs"),
    );

  return copy.blob;
}

export const RecordCopies = { capture, read };
