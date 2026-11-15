import { ImagePreflight } from "./image-preflight";
import { DocumentSession, type SessionOptions } from "../modules/session";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { DocumentWriterLease } from "./writer-lock";
import { DocumentJobs, DocumentReader } from "../modules/jobs";

function create(
  options: Omit<SessionOptions, "persistence" | "acquire" | "open">,
): DocumentSession {
  return new DocumentSession({
    ...options,
    preflight: ImagePreflight.validate,
    decode: DocumentReader.decode,
    prepare: DocumentReader.prepare,
    persistence: new DocumentJobs(),
    acquire: DocumentWriterLease.acquireWriterLease,
    open: DocumentRepositoryAdapter.openRepository,
  });
}

export const DocumentSessions = { create };
