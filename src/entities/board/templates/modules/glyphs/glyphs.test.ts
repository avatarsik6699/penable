import { describe, expect, it } from "vitest";
import { TemplateGlyphs } from "./glyphs";
import { GlyphAtlas } from "./glyph-atlas";

describe("prepared Klee One metrics", () => {
  it.each([..."0123456789xyπ−/."])(
    "uses real finite outlines and ink metrics for %s",
    (character) => {
      const run = TemplateGlyphs.run(character, 22);
      const glyph = GlyphAtlas[character as keyof typeof GlyphAtlas];

      expect(run.glyphs).toHaveLength(1);
      expect(run.glyphs[0]!.path).toBe(glyph.path);

      expect(run.width).toBeCloseTo(
        (glyph.bounds[2] - glyph.bounds[0]) * 0.022,
      );

      expect(run.height).toBeCloseTo(
        (glyph.bounds[3] - glyph.bounds[1]) * 0.022,
      );

      expect(run.width).toBeGreaterThan(0);
      expect(run.height).toBeGreaterThan(0);
    },
  );

  it("scales uniformly, accounts for actual character widths and rejects unsupported input", () => {
    const small = TemplateGlyphs.run("−100.5π/6xy", 22),
      large = TemplateGlyphs.run("−100.5π/6xy", 44);

    expect(large.width).toBeCloseTo(small.width * 2);
    expect(large.height).toBeCloseTo(small.height * 2);

    expect(TemplateGlyphs.run("1", 22).width).not.toBe(
      TemplateGlyphs.run("8", 22).width,
    );

    expect(TemplateGlyphs.run(" ", 22).glyphs).toHaveLength(0);
    expect(() => TemplateGlyphs.run("bad", 22)).toThrow("Unsupported");
  });
});
