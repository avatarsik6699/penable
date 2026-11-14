import { testBoards } from "./boards";
import type { TestBoardTypes } from "./board.types";

export const mathBoards = {
  legacy(): TestBoardTypes.StoredDocument {
    const document = testBoards.previousV4();

    document.tools.writing = testBoards.pressureHeavy().tools.writing;

    const base: TestBoardTypes.TemplateItem["template"] = {
      kind: "number-line",
      width: 320,
      height: 80,
      color: "#182230",
      lineWidth: 2,
      dashed: false,
      fill: null,
      min: -5,
      max: 5,
      step: 1,
      numbers: true,
      grid: false,
      labels: true,
      rays: false,
    };

    return {
      ...document,
      schemaVersion: 5,
      assets: [],
      items: [
        {
          kind: "template",
          id: 20,
          generatorVersion: 1,
          template: base,
          matrix: [1, 0, 0, 1, 150, 250],
        },
        {
          kind: "template",
          id: 21,
          generatorVersion: 1,
          template: { ...base, kind: "axes", height: 320 },
          matrix: [0.7, 0, 0, 0.7, 520, 220],
        },
        {
          kind: "template",
          id: 22,
          generatorVersion: 1,
          template: { ...base, kind: "circle", height: 320 },
          matrix: [0.7, 0, 0, 0.7, 760, 220],
          source: "legacy_math_circle",
          clip: [
            [
              [
                [140, 0],
                [340, 0],
                [340, 340],
                [140, 340],
                [140, 0],
              ],
            ],
          ],
        },
      ],
    };
  },
};
