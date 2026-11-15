import type { BoardDocument } from "../board-document.types";
import { DocumentJobs } from "../modules/jobs";
import { DocumentCodec } from "../modules/codec";

export const DocumentExports = {
  async serialize(document: BoardDocument, signal: AbortSignal) {
    // Recovery downloads must remain available without a writer lease. This worker
    // owns no save queue and its cancellation cannot interrupt durable persistence.
    const jobs = new DocumentJobs(),
      captured = { ...document, strokes: [...document.strokes] };

    try {
      let result;

      try {
        result = await jobs.export(captured, signal);
      } finally {
        await jobs.close();
      }

      if (signal.aborted) throw new DOMException("", "AbortError");

      return { contents: result.blob, warning: result.warning };
    } catch (error) {
      if (
        signal.aborted ||
        (error instanceof Error && error.name === "AbortError")
      )
        throw error;

      // A failed save worker must never remove the independent emergency download.
      // Synchronous processing is deliberately limited to this recovery path.
      const recovery = DocumentCodec.serializeDocument(captured);

      return { contents: recovery.json, warning: recovery.warning };
    }
  },
};
