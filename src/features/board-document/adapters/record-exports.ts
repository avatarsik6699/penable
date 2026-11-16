import { RecordCopies } from "../modules/record-copies";
import { DocumentCodec } from "../modules/codec";
import { DocumentJobs } from "../modules/jobs";
import type { BoardDocument } from "../board-document.types";

async function serialize(
  value: unknown,
  signal: AbortSignal,
): Promise<Blob | string> {
  const copy = RecordCopies.read(value);

  if (copy) return copy;

  if (
    value &&
    typeof value === "object" &&
    "strokes" in value &&
    "format" in value &&
    value.format === "penable-board"
  ) {
    const jobs = new DocumentJobs();

    try {
      try {
        return await jobs.exportRaw(value as BoardDocument, signal);
      } finally {
        await jobs.close();
      }
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;

      // Emergency recovery keeps the original raw runtime representation.
      return DocumentCodec.serializeRawBackup(value);
    }
  }

  // Small catalog records and the independent Worker-blocked startup fallback.
  return DocumentCodec.serializeRawBackup(value);
}

export const DocumentRecordExports = { serialize };
