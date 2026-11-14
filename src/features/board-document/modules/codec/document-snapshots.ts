import { type BoardDocument } from "../../board-document.types";
import {
  BoardWriting,
  BoardSnapshots,
  type BoardSnapshot,
} from "~/entities/board";

function emptyDocument(): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: 5,
    strokes: [],
    viewport: { zoom: 1, x: 0, y: 0 },
    background: "blank",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    tools: { width: 3, stabilization: 65, writing: BoardWriting.defaults() },
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
    backgroundSettings: {
      ...(document.backgroundSettings ?? { contrast: 45, spacing: 24 }),
    },
    lastWritingView: document.lastWritingView
      ? {
          center: { ...document.lastWritingView.center },
          zoom: document.lastWritingView.zoom,
        }
      : null,
    tools: document.tools,
  };
}

function fromSnapshot(snapshot: BoardSnapshot): BoardDocument {
  return {
    format: "penable-board",
    schemaVersion: 5,
    strokes: snapshot.strokes,
    viewport: snapshot.viewport,
    background: snapshot.background,
    tools: snapshot.tools,
    backgroundSettings: {
      ...(snapshot.backgroundSettings ?? { contrast: 45, spacing: 24 }),
    },
    lastWritingView: snapshot.lastWritingView
      ? {
          center: { ...snapshot.lastWritingView.center },
          zoom: snapshot.lastWritingView.zoom,
        }
      : null,
  };
}

export const DocumentSnapshots = { toSnapshot, fromSnapshot };

export const SnapshotOperations = {
  cloneDocument,
  emptyDocument,
  DocumentSnapshots,
};
