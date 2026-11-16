import { BoardWriting } from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";

function completed(document: BoardDocument): BoardDocument {
  return {
    ...document,
    strokes: [...document.strokes],
    viewport: { ...document.viewport },
    tools: {
      ...document.tools,
      ...(document.tools.writing
        ? { writing: BoardWriting.clone(document.tools.writing) }
        : {}),
    },
    backgroundSettings: {
      ...(document.backgroundSettings ?? { contrast: 45, spacing: 24 }),
    },
    lastWritingView: document.lastWritingView
      ? {
          center: { ...document.lastWritingView.center },
          zoom: document.lastWritingView.zoom,
        }
      : null,
  };
}

export const DocumentCapture = { completed };
