import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardTemplates, type TemplateItem } from "~/entities/board";
import { TemplatePaint } from "./template-paint";

afterEach(() => vi.unstubAllGlobals());

describe("versioned template canvas replay", () => {
  it("replays identical prepared vector glyph paths and transforms for editor or PNG contexts without native text", () => {
    const constructors: string[] = [];

    class NativePath {
      constructor(path: string) {
        constructors.push(path);
      }
    }

    vi.stubGlobal("Path2D", NativePath);

    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      setLineDash: vi.fn(),
      transform: vi.fn(),
    };

    const item: TemplateItem = {
      kind: "template",
      id: 1,
      generatorVersion: 2,
      template: BoardTemplates.defaults("circle"),
      matrix: [1, 0, 0, 1, 0, 0],
    };

    TemplatePaint.paint(ctx as unknown as CanvasRenderingContext2D, item);

    const labels = BoardTemplates.layout(item.template, 2).primitives.filter(
      (p) => p.kind === "label",
    );

    const glyphs = labels.flatMap((p) => p.glyphs);

    expect(new Set(constructors)).toEqual(new Set(glyphs.map((g) => g.path)));
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalledTimes(glyphs.length);

    for (const label of labels)
      for (const glyph of label.glyphs)
        expect(ctx.transform).toHaveBeenCalledWith(
          glyph.scale,
          0,
          0,
          glyph.scale,
          label.x + glyph.x,
          label.y + glyph.y,
        );

    const prior = constructors.length;

    TemplatePaint.paint(
      ctx as unknown as OffscreenCanvasRenderingContext2D,
      item,
    );

    expect(constructors).toHaveLength(prior);
    expect(ctx.save.mock.calls.length).toBe(ctx.restore.mock.calls.length);
  });
});
