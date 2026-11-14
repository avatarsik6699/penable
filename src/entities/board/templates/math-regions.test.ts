import { describe, expect, it } from "vitest";
import { BoardRegions } from "../regions";
import type { TemplateItem } from "../board.types";
import { BoardTemplates } from "./templates";

const item = (version: 1 | 2): TemplateItem => ({
  kind: "template",
  id: version,
  generatorVersion: version,
  template: BoardTemplates.defaults("axes"),
  matrix: [1, 0, 0, 1, 0, 0],
  source: "same",
});

describe("versioned math region geometry", () => {
  it("uses actual glyph label extents for selection/cuts and preserves version through fragments", () => {
    const source = item(2);

    const label = BoardTemplates.layout(source.template, 2).primitives.find(
      (p) => p.kind === "label" && p.text === "−5",
    )!;

    if (label.kind !== "label") throw new Error("Missing label");

    const region = BoardRegions.rectangle(
      { x: label.x - 1, y: label.y - 1 },
      { x: label.x + label.width + 1, y: label.y + label.height + 1 },
    );

    const parts = BoardRegions.selectParts([source], region, () => 10);

    expect(parts).toHaveLength(1);

    expect(parts[0]!.selected).toMatchObject({
      kind: "template",
      generatorVersion: 2,
    });

    expect(parts[0]!.selected.clip).toBeDefined();

    expect(BoardRegions.sourceBounds(source)).toEqual(
      BoardTemplates.layout(source.template, 2).bounds,
    );

    expect(BoardRegions.sourceBounds(item(1))).toEqual(
      BoardTemplates.layout(source.template, 1).bounds,
    );
  });

  it("never recombines different generators under an identical source/transform", () => {
    expect(BoardRegions.groupedStrokes([item(1), item(2)])).toHaveLength(2);
  });
});
