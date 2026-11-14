import { GlyphAtlas } from "./glyph-atlas";
import type { GlyphRun } from "./glyphs.types";

function run(text: string, size: number): GlyphRun {
  const scale = size / 1000;

  let advance = 0,
    left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity;

  const glyphs: { path: string; x: number; y: number; scale: number }[] = [];

  for (const character of text) {
    const glyph = GlyphAtlas[character as keyof typeof GlyphAtlas];

    if (!glyph) throw new Error(`Unsupported mathematical glyph: ${character}`);

    if (glyph.path) {
      left = Math.min(left, advance + glyph.bounds[0] * scale);
      top = Math.min(top, glyph.bounds[1] * scale);
      right = Math.max(right, advance + glyph.bounds[2] * scale);
      bottom = Math.max(bottom, glyph.bounds[3] * scale);
      glyphs.push({ path: glyph.path, x: advance, y: 0, scale });
    }

    advance += glyph.advance * scale;
  }

  if (!glyphs.length) return { width: advance, height: 0, glyphs: [] };

  return {
    width: right - left,
    height: bottom - top,
    glyphs: glyphs.map((glyph) => ({ ...glyph, x: glyph.x - left, y: -top })),
  };
}

export const TemplateGlyphs = { run };
