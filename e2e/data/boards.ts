import type { TestBoardTypes } from "./board.types";

export const testBoards = {
  document(schemaVersion: 1 | 2 | 3 = 3): TestBoardTypes.Document {
    return {
      format: "penable-board",
      schemaVersion,
      strokes: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      background: "blank",
      tools: { width: 3, stabilization: 65 },
      ...(schemaVersion === 3
        ? {
            backgroundSettings: { contrast: 45, spacing: 24 },
            lastWritingView: null,
          }
        : {}),
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

  previousV2(): TestBoardTypes.Document {
    return { ...testBoards.legacy(), schemaVersion: 2, background: "dots" };
  },

  previousV3(): TestBoardTypes.Document {
    return {
      ...testBoards.document(3),
      strokes: [
        {
          ...testBoards.legacy().strokes[0]!,
          source: "v3_original",
          translation: { x: 25, y: 30 },
        },
      ],
      background: "dots",
      backgroundSettings: { contrast: 60, spacing: 32 },
      lastWritingView: { center: { x: 400, y: 300 }, zoom: 2 },
    };
  },

  previousV4(): TestBoardTypes.StoredDocument & { legacyNote: string } {
    const { strokes, ...metadata } = testBoards.previousV3();

    return {
      ...metadata,
      schemaVersion: 4,
      legacyNote: "Preserve exact raw schema4 before migration",
      items: strokes.map(({ translation, ...stroke }) => ({
        ...stroke,
        kind: "ink",
        matrix: [1, 0, 0, 1, translation?.x ?? 0, translation?.y ?? 0],
      })),
      assets: [],
    };
  },

  pressureHeavy(): TestBoardTypes.StoredDocument {
    const { strokes, ...document } = testBoards.heavy();

    const pen = {
      color: "#182230",
      width: 3,
      stabilization: 65,
      opacity: 1,
      pressureStrength: 65,
    };

    return {
      ...document,
      schemaVersion: 5,
      items: strokes.map((stroke) => ({
        ...stroke,
        kind: "ink",
        matrix: [1, 0, 0, 1, 0, 0],
        style: { instrument: "pressure", opacity: 1, pressureStrength: 65 },
      })),
      assets: [],
      tools: {
        ...document.tools,
        writing: {
          instrument: "pressure",
          instruments: {
            pen,
            pressure: { ...pen },
            highlighter: { ...pen, width: 20, opacity: 0.3, color: "#f4c430" },
          },
        },
      },
    };
  },

  corrupt(): unknown {
    return {
      format: "penable-board",
      schemaVersion: 4,
      items: "corrupt-owned-test",
      assets: [],
    };
  },

  catalogWithMissingBoard(): TestBoardTypes.LegacyCatalog {
    return {
      format: "penable-library",
      schemaVersion: 1,
      activeId: "main",
      boards: [{ id: "main", title: "Моя доска" }],
    };
  },

  distant(): TestBoardTypes.Document {
    const result = testBoards.document();
    const stroke = testBoards.legacy().strokes[0]!;

    result.strokes = [
      stroke,
      {
        ...stroke,
        id: 8,
        source: "test_remote",
        translation: { x: 20000, y: 0 },
      },
    ];

    result.lastWritingView = { center: { x: 640, y: 450 }, zoom: 1 };

    return result;
  },

  previous(): TestBoardTypes.Document {
    return { ...testBoards.document(), background: "grid" };
  },
};
