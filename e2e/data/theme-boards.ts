import type { TestBoardTypes } from "./board.types";
import { testBoards } from "./boards";

const palette = [
  "#182230",
  "#667085",
  "#175cd3",
  "#0ba5ec",
  "#0e9384",
  "#2e7d32",
  "#f4c430",
  "#e87518",
  "#d92d20",
  "#7f56d9",
] as const;

function mixed(image: Buffer): TestBoardTypes.StoredDocument {
  const settings = testBoards.pressureHeavy().tools;
  const items: TestBoardTypes.Item[] = [];

  for (const [row, instrument] of ["pen", "pressure", "highlighter"].entries())
    for (const [column, color] of palette.entries())
      items.push({
        kind: "ink",
        id: items.length + 1,
        color,
        width: instrument === "highlighter" ? 20 : 8,
        matrix: [1, 0, 0, 1, 80 + column * 105, 210 + row * 80],
        style: {
          instrument: instrument as "pen" | "pressure" | "highlighter",
          opacity: instrument === "highlighter" ? 0.3 : 1,
          pressureStrength: 65,
        },
        points: [
          { x: 0, y: 0, pressure: 0.5, time: 1 },
          { x: 60, y: 0, pressure: 0.5, time: 2 },
        ],
      });

  for (const [index, kind] of ["rectangle", "axes", "number-line"].entries())
    items.push({
      kind: "template",
      id: items.length + 1,
      generatorVersion: index === 1 ? 1 : 2,
      matrix: [1, 0, 0, 1, 100 + index * 275, 490],
      template: {
        kind: kind as "rectangle" | "axes" | "number-line",
        width: 180,
        height: kind === "number-line" ? 80 : 180,
        color: "#182230",
        fill: kind === "rectangle" ? "#175cd3" : null,
        lineWidth: 3,
        dashed: false,
        min: -2,
        max: 2,
        step: 1,
        numbers: true,
        grid: true,
        labels: true,
        rays: false,
      },
    });

  items.push({
    kind: "image",
    id: items.length + 1,
    assetId: "theme_quadrants",
    matrix: [0.75, 0, 0, 0.75, 950, 500],
  });

  return {
    format: "penable-board",
    schemaVersion: 5,
    viewport: { x: 0, y: 0, zoom: 1 },
    background: "grid",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    tools: settings,
    items,
    assets: [
      {
        id: "theme_quadrants",
        mime: "image/png",
        width: 240,
        height: 160,
        base64: image.toString("base64"),
      },
    ],
  };
}

export const themeBoards = { palette, mixed };
