import type { TestBoardTypes } from "./board.types";

function catalog(): TestBoardTypes.LegacyCatalog {
  return {
    format: "penable-library",
    schemaVersion: 1,
    activeId: "main",
    boards: Array.from({ length: 100 }, (_, index) => ({
      id: index === 0 ? "main" : `appearance-${index}`,
      title: `Доска ${index + 1}`,
    })),
  };
}

function records(): Record<string, unknown> {
  const original = catalog();

  const document: TestBoardTypes.StoredDocument = {
    format: "penable-board",
    schemaVersion: 4,
    items: [],
    assets: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    background: "blank",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    tools: { width: 3, stabilization: 65 },
  };

  return {
    library: original,
    ...Object.fromEntries(
      original.boards.map((board) => [
        board.id === "main" ? "main" : `board:${board.id}`,
        document,
      ]),
    ),
  };
}

export const appearanceBoards = { catalog, records };
