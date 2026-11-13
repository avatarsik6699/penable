import type { TestBoardTypes } from "./board.types";

export const testBoards = {
  document(schemaVersion: 1 | 2 = 2): TestBoardTypes.Document {
    return {
      format: "penable-board",
      schemaVersion,
      strokes: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      background: "blank",
      tools: { width: 3, stabilization: 65 },
    };
  },
  legacy(): TestBoardTypes.Document {
    const result = testBoards.document(1);
    result.strokes = [
      {
        id: 7,
        color: "#182230",
        width: 2,
        points: [
          { x: 50, y: 50, pressure: 0.2, time: 1 },
          { x: 80, y: 60, pressure: 0.6, time: 5 },
          { x: 120, y: 50, pressure: 0, time: 9 },
        ],
        stabilization: { mode: "light", captureZoom: 1 },
      },
    ];
    return result;
  },
  heavy(): TestBoardTypes.Document {
    const result = testBoards.document();
    result.strokes = [
      {
        id: 1,
        color: "#182230",
        width: 3,
        points: Array.from({ length: 100000 }, (_, index) => ({
          x: 100 + (280 * index) / 99999,
          y: 125 + Math.sin(index / 1000) * 15,
          pressure: 0.5,
          time: index,
        })),
        stabilization: { strength: 65, captureZoom: 1 },
      },
    ];
    return result;
  },
  previous(): TestBoardTypes.Document {
    return { ...testBoards.document(), background: "grid" };
  },
};
