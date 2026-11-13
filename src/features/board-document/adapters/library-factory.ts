import { PreviewLoader } from "./preview-loader";
import { ImagePreflight } from "./image-preflight";
import { BoardLibrarySession } from "../modules/library";
import type { LibraryOptions } from "../modules/library";
import { DocumentSession } from "../modules/session";
import { DocumentJobs } from "../modules/jobs";
import { DocumentWriterLease } from "./writer-lock";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { LibraryRepositoryAdapter } from "./library-indexeddb";

function create(
  options: Pick<
    LibraryOptions,
    "snapshot" | "onHydrate" | "onState" | "onLibrary" | "preview"
  >,
): BoardLibrarySession {
  return new BoardLibrarySession({
    ...options,
    previewLoad: PreviewLoader.load,
    preflight: ImagePreflight.validate,
    acquire: DocumentWriterLease.acquireWriterLease,
    open: LibraryRepositoryAdapter.open,
    id: () => `board-${crypto.randomUUID()}`,
    session: (id, lease, callbacks) =>
      new DocumentSession({
        ...callbacks,
        preflight: ImagePreflight.validate,
        acquire: async () => lease,
        open: (invalidated) =>
          DocumentRepositoryAdapter.openRepository(invalidated, undefined, id),
        persistence: new DocumentJobs({ boardId: id }),
      }),
  });
}

export const BoardLibraries = { create };
