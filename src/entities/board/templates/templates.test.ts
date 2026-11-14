import { describe, expect, it } from "vitest";
import { BoardTemplates } from "./templates";
import { BoardRegions } from "../regions";
import type { TemplateItem } from "../board.types";

describe("vector templates", () => {
  it.each(BoardTemplates.kinds)(
    "generates bounded non-empty %s geometry",
    (kind) => {
      const config = BoardTemplates.defaults(kind),
        layout = BoardTemplates.layout(config);

      expect(BoardTemplates.validate(config)).toBe("");
      expect(layout.primitives.length).toBeGreaterThan(0);
      expect(Object.values(layout.bounds).every(Number.isFinite)).toBe(true);
      expect(BoardTemplates.layout(config)).toBe(layout);
    },
  );

  it("uses analytical ellipses and radians-only principal angles", () => {
    const layout = BoardTemplates.layout(BoardTemplates.defaults("circle"));

    expect(layout.primitives.filter((p) => p.kind === "ellipse")).toHaveLength(
      1,
    );

    const labels = layout.primitives.flatMap((p) =>
      p.kind === "text" ? [p.text] : [],
    );

    expect(labels).toContain("π/6");
    expect(labels).toContain("π/4");
    expect(labels).toContain("11π/6");
    expect(labels.some((p) => p.includes("°"))).toBe(false);

    expect(
      BoardTemplates.validate({
        ...BoardTemplates.defaults("circle"),
        width: 40,
        height: 40,
      }),
    ).not.toBe("");

    expect(
      BoardTemplates.validate({
        ...BoardTemplates.defaults("circle"),
        height: 400,
      }),
    ).not.toBe("");
  });

  it("rejects dense, reversed and nonfinite numeric ranges", () => {
    const source = BoardTemplates.defaults("axes");

    for (const patch of [
      { step: 0 },
      { step: 0.01 },
      { min: 5, max: 1 },
      { step: NaN },
      { width: Infinity },
      { min: 1, max: 10 },
    ])
      expect(BoardTemplates.validate({ ...source, ...patch })).not.toBe("");
  });

  it("retains one source and exact clip masks for partial template cuts", () => {
    const item: TemplateItem = {
      kind: "template",
      id: 1,
      generatorVersion: 1,
      template: BoardTemplates.defaults("rectangle"),
      matrix: [1, 0, 0, 1, 0, 0],
    };

    const region = BoardRegions.rectangle({ x: 0, y: 0 }, { x: 180, y: 330 });
    const parts = BoardRegions.selectParts([item], region, () => 2);

    expect(parts).toHaveLength(1);
    expect(parts[0]!.selected.kind).toBe("template");
    expect(parts[0]!.remainder?.kind).toBe("template");
    expect(parts[0]!.selected.clip).toBeDefined();
    expect(parts[0]!.selected.source).toBe(parts[0]!.remainder!.source);
  });

  it("reserves numeric label width before accepting fractional and large tick ranges", () => {
    const source = BoardTemplates.defaults("axes");

    expect(
      BoardTemplates.validate({
        ...source,
        min: -0.00001,
        max: 0.00001,
        step: 0.000002,
      }),
    ).not.toBe("");

    expect(
      BoardTemplates.validate({
        ...source,
        min: -10000,
        max: 10000,
        step: 2000,
      }),
    ).not.toBe("");

    expect(
      BoardTemplates.validate({
        ...source,
        width: 1000,
        height: 1000,
        min: -10000,
        max: 10000,
        step: 2000,
      }),
    ).toBe("");

    expect(BoardTemplates.validate(source)).toBe("");
  });
});
