import { describe, expect, it, vi } from "vitest";
import { BoardTemplates } from "./templates";
import { LegacyTemplates } from "./legacy-templates";
import type { TemplateConfig } from "../board.types";

const labels = (config: TemplateConfig) =>
  BoardTemplates.layout(config, 2).primitives.filter((p) => p.kind === "label");

function separated(config: TemplateConfig) {
  const list = labels(config);

  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!,
        b = list[j]!;

      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
        `${a.text} overlaps ${b.text}`,
      ).toBe(true);
    }
}

describe("version2 handwritten math layouts", () => {
  it.each(["number-line", "axes"] as const)(
    "autosizes every tick label for required %s ranges",
    (kind) => {
      for (const [min, max] of [
        [0, 15],
        [0, 100],
        [-100, 100],
      ] as const) {
        const config = { ...BoardTemplates.defaults(kind), min, max, step: 1 };

        expect(BoardTemplates.validate(config, 2)).toBe("");

        const prepared = BoardTemplates.prepare(config);

        expect(prepared.width).toBeGreaterThan(320);

        const numbers = labels(config).filter(
          (p) => p.text !== "x" && p.text !== "y",
        );

        expect(numbers).toHaveLength(
          kind === "axes" ? (max - min) * 2 + 1 : max - min + 1,
        );

        expect(numbers.filter((p) => p.text === "0")).toHaveLength(1);
        expect(numbers.map((p) => p.text)).toContain(String(max));
        separated(config);
        expect(prepared.width).toBeLessThanOrEqual(32768);

        if (kind === "axes") expect(prepared.width).toBe(prepared.height);
      }
    },
  );

  it("bounds enumeration before the 201 tick and local size limits", () => {
    const base = {
      ...BoardTemplates.defaults("axes"),
      min: 0,
      max: 200,
      step: 1,
    };

    expect(BoardTemplates.validate(base, 2)).toBe("");
    expect(BoardTemplates.validate({ ...base, max: 201 }, 2)).toContain("201");

    expect(
      BoardTemplates.validate(
        { ...base, min: -10000, max: 10000, step: 1e-6 },
        2,
      ),
    ).toContain("201");

    expect(
      BoardTemplates.validate(
        { ...base, min: -10000, max: 10000, step: 0.0000001 },
        2,
      ),
    ).not.toBe("");

    expect(BoardTemplates.validate({ ...base, width: 32769 }, 2)).not.toBe("");

    expect(
      BoardTemplates.validate(
        { ...base, min: -0.0001, max: 0.0001, step: 0.000001 },
        2,
      ),
    ).toBe("");

    expect(() => BoardTemplates.layout(base, 3 as 2)).toThrow("версия");
  });

  it("uses one XY zero below-left of the intersection and keeps labels clear of both axes", () => {
    const config = BoardTemplates.defaults("axes"),
      origin = BoardTemplates.origin(config, 2);

    for (const label of labels(config)) {
      expect(
        label.x + label.width <= origin.x - 6 || label.x >= origin.x + 6,
      ).toBe(true);

      expect(
        label.y + label.height <= origin.y - 6 || label.y >= origin.y + 6,
      ).toBe(true);

      if (label.text === "0") {
        expect(label.x + label.width).toBeLessThan(origin.x);
        expect(label.y).toBeGreaterThan(origin.y);
      }
    }
  });

  it("separates circle angle and coordinate controls without changing axis names", () => {
    const config = BoardTemplates.defaults("circle");

    for (const rays of [false, true]) separated({ ...config, rays });

    const angles = labels({ ...config, numbers: false });

    expect(angles.map((p) => p.text)).toContain("11π/6");
    expect(angles.filter((p) => p.text === "−1")).toHaveLength(0);

    const coordinates = labels({ ...config, labels: false });

    expect(coordinates.map((p) => p.text)).toEqual([
      "x",
      "y",
      "1",
      "−1",
      "1",
      "−1",
    ]);

    expect(
      labels({ ...config, labels: false, numbers: false }).map((p) => p.text),
    ).toEqual(["x", "y"]);

    for (const p of labels(config)) {
      if (["1", "−1"].includes(p.text)) {
        for (const x of [p.x, p.x + p.width])
          for (const y of [p.y, p.y + p.height])
            expect(Math.hypot(x - 240, y - 240)).toBeLessThan(154);
      }
    }
  });

  it("keeps cache, bounds and full legacy primitives isolated by actual generator version", () => {
    for (const kind of BoardTemplates.kinds) {
      const config = BoardTemplates.defaults(kind);

      expect(BoardTemplates.layout(config, 1)).toBe(
        LegacyTemplates.layout(config),
      );

      expect(BoardTemplates.validate(config, 1)).toBe(
        LegacyTemplates.validate(config),
      );

      if (BoardTemplates.version(config) === 2) {
        expect(BoardTemplates.layout(config, 2)).not.toBe(
          BoardTemplates.layout(config, 1),
        );

        expect(BoardTemplates.layout(config, 2)).toBe(
          BoardTemplates.layout(config, 2),
        );
      }
    }
  });
});

it("returns cached version2 layout before enumerating ticks or allocating glyph runs on repeated paint", () => {
  const config = {
    ...BoardTemplates.defaults("axes"),
    min: -100,
    max: 100,
    step: 1,
  };

  const first = BoardTemplates.layout(config, 2);
  const enumeration = vi.spyOn(Array, "from");

  try {
    for (let i = 0; i < 100; i++)
      expect(BoardTemplates.layout(config, 2)).toBe(first);

    expect(enumeration).not.toHaveBeenCalled();
  } finally {
    enumeration.mockRestore();
  }
});

it("preserves non-power-of-ten fractional step coordinates and stable plain-decimal labels", () => {
  for (const [min, max, step] of [
    [0, 0.000015, 0.0000015],
    [-0.0000075, 0.000015, 0.0000015],
    [-0.3, 0.7, 0.1],
  ] as const) {
    const config = {
      ...BoardTemplates.defaults("number-line"),
      min,
      max,
      step,
    };

    expect(BoardTemplates.validate(config, 2)).toBe("");

    const list = BoardTemplates.layout(config, 2).primitives;

    const ticks = list.filter(
      (p) =>
        p.kind === "path" &&
        p.points.length === 2 &&
        p.points[0]!.x === p.points[1]!.x,
    );

    const positions = ticks.map((p) =>
      p.kind === "path" ? p.points[0]!.x : 0,
    );

    const expected = positions[1]! - positions[0]!;

    for (let i = 1; i < positions.length; i++)
      expect(positions[i]! - positions[i - 1]!).toBeCloseTo(expected, 8);

    const text = labels(config).map((p) => p.text);

    if (step === 0.0000015) expect(text).toContain("0.0000015");
    else expect(text).toContain("0.3");

    expect(text.some((s) => /[e+]/.test(s))).toBe(false);
  }
});

it("keeps every circle glyph box clear of the axes and angle boxes outside the circumference with rays enabled", () => {
  const config = {
    ...BoardTemplates.defaults("circle"),
    rays: true,
    lineWidth: 12,
  };

  for (const p of labels(config)) {
    expect(p.x + p.width <= 234 || p.x >= 246).toBe(true);
    expect(p.y + p.height <= 234 || p.y >= 246).toBe(true);

    if (["x", "y", "1", "−1"].includes(p.text)) continue;

    const nearX = Math.max(p.x, Math.min(240, p.x + p.width)),
      nearY = Math.max(p.y, Math.min(240, p.y + p.height));

    expect(Math.hypot(nearX - 240, nearY - 240)).toBeGreaterThan(160);
  }
});
