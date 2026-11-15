import { I18n } from "~/shared/lib/i18n";
import { ImagePreflight } from "./image-preflight";
import { BoardLibrarySession } from "../modules/library";
import type { LibraryOptions } from "../modules/library";
import { DocumentSession } from "../modules/session";
import { DocumentJobs, DocumentReader } from "../modules/jobs";
import { DocumentWriterLease } from "./writer-lock";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { LibraryRepositoryAdapter } from "./library-indexeddb";

function create(
  options: Pick<
    LibraryOptions,
    "snapshot" | "onHydrate" | "onState" | "onLibrary"
  >,
): BoardLibrarySession {
  return new BoardLibrarySession({
    ...options,
    initialTitle: I18n.t("myBoard"),
    preflight: ImagePreflight.validate,
    decode: DocumentReader.decode,
    acquire: DocumentWriterLease.acquireWriterLease,
    open: LibraryRepositoryAdapter.open,
    id: () => `board-${crypto.randomUUID()}`,
    session: (id, lease, callbacks) =>
      new DocumentSession({
        ...callbacks,
        preflight: ImagePreflight.validate,
        decode: DocumentReader.decode,
        prepare: DocumentReader.prepare,
        acquire: async () => lease,
        open: (invalidated) =>
          DocumentRepositoryAdapter.openRepository(invalidated, undefined, id),
        persistence: new DocumentJobs({ boardId: id }),
      }),
  });
}

export const BoardLibraries = { create };
