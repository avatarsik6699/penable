import { Messages } from "~/shared/lib/messages";
import { DocumentCodec } from "../codec";
import type { BoardDocument } from "../../board-document.types";
import type { ImportCandidate } from "./import-candidates.types";

const documents = new WeakMap<ImportCandidate, BoardDocument>();

// Only the validated reader result enters this capability; no DTO alias leaves it.
function capture(document: BoardDocument): ImportCandidate {
  const handle = Object.freeze({
    summary: Object.freeze(DocumentCodec.documentStats(document)),
  }) as ImportCandidate;

  documents.set(handle, document);

  return handle;
}

function document(handle: ImportCandidate): BoardDocument {
  const value = documents.get(handle);

  if (!value)
    throw Messages.error(
      Messages.create("replacementCancelledTheCurrentBoardIsRetained"),
    );

  return value;
}

function dispose(handle: ImportCandidate) {
  documents.delete(handle);
}

export const ImportCandidates = { capture, document, dispose };
