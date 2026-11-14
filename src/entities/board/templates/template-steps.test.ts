import { describe, expect, it } from "vitest";
import { BoardTemplates } from "./templates";
import { BoardTemplateSteps } from "./template-steps";

describe("readable automatic template steps", () => {
  it.each([
    [-5, 5],
    [-10000, 10000],
    [-1000, 1000],
    [-5, 10000],
    [-10000, 0],
    [0, 10000],
    [-0.01, 0.01],
    [-0.00001, 0.00001],
    [-0.125, 0.75],
  ])("fits %s…%s without changing versioned geometry", (min, max) => {
    for (const kind of ["axes", "number-line"] as const) {
      const config = { ...BoardTemplates.defaults(kind), min, max };
      const step = BoardTemplateSteps.recommend(config);

      expect(step).not.toBeNull();
      expect(BoardTemplates.validate({ ...config, step: step! })).toBe("");

      expect(
        BoardTemplates.layout({ ...config, step: step! }).primitives.length,
      ).toBeLessThan(250);
    }
  });

  it("keeps the familiar default and accounts for label and available width", () => {
    const config = BoardTemplates.defaults("axes");

    expect(BoardTemplateSteps.recommend(config)).toBe(1);

    const small = BoardTemplateSteps.recommend({
      ...config,
      min: -10000,
      max: 10000,
    });

    const large = BoardTemplateSteps.recommend({
      ...config,
      width: 1000,
      height: 1000,
      min: -10000,
      max: 10000,
    });

    expect(small!).toBeGreaterThan(large!);

    expect(
      BoardTemplateSteps.recommend({
        ...config,
        numbers: false,
        min: -10000,
        max: 10000,
      }),
    ).toBe(2000);
  });

  it.each([
    { min: 1, max: 10 },
    { min: 5, max: -5 },
    { min: -Infinity },
    { max: 10001 },
    { width: 1 },
    { min: 0, max: 0.0000001 },
  ])("does not invent a valid step for invalid config %j", (patch) => {
    expect(
      BoardTemplateSteps.recommend({
        ...BoardTemplates.defaults("axes"),
        ...patch,
      }),
    ).toBeNull();
  });
});
