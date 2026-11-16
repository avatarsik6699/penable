import type { MessageTypes } from "~/shared/lib/messages";

export type SerializedRecordCopy = {
  exists: boolean;
  schemaVersion?: string | number | boolean | null;
  blob?: Blob;
  error?: MessageTypes.Value;
};
