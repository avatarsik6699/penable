import { DocumentStorageLoader } from "./storage-loader";
import { DocumentPersistenceAdapter } from "./document-persistence";
import { ImagePreflight } from "./image-preflight";
import { DocumentSession, type SessionOptions } from "../modules/session";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { DocumentWriterLease } from "./writer-lock";
import { DocumentReader } from "../modules/jobs";

function create(
  options: Omit<SessionOptions, "persistence" | "acquire" | "open">,
): DocumentSession {
  return new DocumentSession({
    ...options,
    loadOwned: (signal) => DocumentStorageLoader.load("main", signal),
    preflight: ImagePreflight.validate,
    decode: DocumentReader.decodeOwned,
    prepare: DocumentReader.prepare,
    persistence: DocumentPersistenceAdapter.create(),
    acquire: DocumentWriterLease.acquireWriterLease,
    open: DocumentRepositoryAdapter.openRepository,
  });
}

export const DocumentSessions = { create };
