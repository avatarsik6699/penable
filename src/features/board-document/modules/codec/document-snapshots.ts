import { type BoardDocument } from "../../board-document.types";
import { BoardSnapshots, type BoardSnapshot } from "~/entities/board";

function emptyDocument(): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: 2,
    strokes: [],
    viewport: { zoom: 1, x: 0, y: 0 },
    background: "blank",
    tools: { width: 3, stabilization: 65 },
  };
}

function cloneDocument(document: BoardDocument): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: document.schemaVersion,
    ...BoardSnapshots.clone(document),
  };
}

function toSnapshot(document: BoardDocument): BoardSnapshot {
  return {
    strokes: document.strokes,
    viewport: document.viewport,
    background: document.background,
    tools: document.tools,
  };
}

function fromSnapshot(snapshot: BoardSnapshot): BoardDocument {
  return { format: "penable-board", schemaVersion: 2, ...snapshot };
}

export const DocumentSnapshots = { toSnapshot, fromSnapshot };

export const SnapshotOperations = {
  cloneDocument,
  emptyDocument,
  DocumentSnapshots,
};
