import { DocumentStorageLoader } from "./storage-loader";
import { I18n } from "~/shared/lib/i18n";
import { DocumentPersistenceAdapter } from "./document-persistence";
import { ImagePreflight } from "./image-preflight";
import { BoardLibrarySession } from "../modules/library";
import type { LibraryOptions } from "../modules/library";
import { DocumentSession } from "../modules/session";
import { DocumentReader } from "../modules/jobs";
import { DocumentWriterLease } from "./writer-lock";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { LibraryRepositoryAdapter } from "./library-indexeddb";

function create(
  options: Pick<
    LibraryOptions,
    "snapshot" | "onHydrate" | "onState" | "onLibrary" | "onRecoveryPreview"
  >,
): BoardLibrarySession {
  return new BoardLibrarySession({
    ...options,
    initialTitle: I18n.t("myBoard"),
    prepareOwned: DocumentStorageLoader.load,
    preflight: ImagePreflight.validate,
    decode: DocumentReader.decodeOwned,
    acquire: DocumentWriterLease.acquireWriterLease,
    open: LibraryRepositoryAdapter.open,
    id: () => `board-${crypto.randomUUID()}`,
    session: (id, lease, callbacks) =>
      new DocumentSession({
        ...callbacks,
        loadOwned: (signal) => DocumentStorageLoader.load(id, signal),
        preflight: ImagePreflight.validate,
        decode: DocumentReader.decodeOwned,
        prepare: DocumentReader.prepare,
        acquire: async () => lease,
        open: (invalidated) =>
          DocumentRepositoryAdapter.openRepository(invalidated, undefined, id),
        persistence: DocumentPersistenceAdapter.create(id),
      }),
  });
}

export const BoardLibraries = { create };
