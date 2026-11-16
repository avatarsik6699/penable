import type { DocumentPersistence } from "../board-document.types";
import { DocumentJobs } from "../modules/jobs";

function create(boardId = "main"): DocumentPersistence {
  const jobs = new DocumentJobs({ boardId });

  return {
    write: (document) => jobs.write(document),
    replace: (previous, candidate) =>
      jobs.replaceValidated(previous, candidate),
    close: () => jobs.close(),
  };
}

export const DocumentPersistenceAdapter = { create };
