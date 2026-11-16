import type { TestBoardTypes } from "./board.types";
import { testBoards } from "./boards";

export const performanceBoards = {
  million(): TestBoardTypes.Document {
    return {
      ...testBoards.document(),
      strokes: Array.from({ length: 20000 }, (_, source) => ({
        id: source + 1,
        color: "#182230",
        width: 3,
        stabilization: { strength: 65, captureZoom: 1 },
        points: Array.from({ length: 50 }, (_, index) => ({
          x: 2000 + (source % 100) * 64 + index,
          y: 2000 + Math.floor(source / 100) * 8 + (index % 3),
          pressure: (index % 5) / 4,
          time: source * 50 + index,
        })),
      })),
    };
  },
};
