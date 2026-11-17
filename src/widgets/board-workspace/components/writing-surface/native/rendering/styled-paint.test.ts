import { describe, expect, it, vi } from "vitest";
import { Theme } from "~/shared/lib/theme";
import {
  BoardTemplates,
  BoardWriting,
  BoardConstants,
  type Stroke,
  type ImageItem,
  type TemplateItem,
} from "~/entities/board";
import { BoardPaint } from "./paint";

function context() {
  const alphas: number[] = [];
  const stack: number[] = [];

  const ctx = {
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    save: () => stack.push(ctx.globalAlpha),

    restore: () => {
      ctx.globalAlpha = stack.pop()!;
    },

    transform: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    clip: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: () => alphas.push(ctx.globalAlpha),
    drawImage: () => alphas.push(ctx.globalAlpha),
    fillText: vi.fn(),
    setLineDash: vi.fn(),
  };

  return { ctx, alphas, target: ctx as unknown as CanvasRenderingContext2D };
}

const marker: Stroke = {
  id: 1,
  color: BoardConstants.INK,
  width: 20,
  style: { instrument: "highlighter", opacity: 0.3, pressureStrength: 65 },
  points: [
    { x: 0, y: 0, pressure: 1, time: 0 },
    { x: 10, y: 0, pressure: 1, time: 1 },
  ],
};

describe("mixed alpha painting", () => {
  it("adapts every palette color for all instruments while retaining source color and opacity", () => {
    expect(Theme.colors).toEqual(
      BoardWriting.palette.map((entry) => entry.color),
    );

    for (const entry of BoardWriting.palette) {
      for (const instrument of BoardWriting.instruments) {
        const h = context();

        const ink: Stroke = {
          ...marker,
          color: entry.color,
          points: [{ x: 0, y: 0, pressure: 0.5, time: 0 }],
          style: {
            ...marker.style!,
            instrument,
            opacity: instrument === "highlighter" ? 0.3 : 1,
          },
        };

        const original = structuredClone(ink);

        BoardPaint.paintStroke(
          h.target,
          ink,
          false,
          undefined,
          false,
          undefined,
          "dark",
        );

        expect(h.ctx.fillStyle).toBe(Theme.color(entry.color, "dark"));
        expect(h.ctx.strokeStyle).toBe(Theme.color(entry.color, "dark"));
        expect(ink).toEqual(original);
        expect(h.ctx.globalAlpha).toBe(ink.style!.opacity);
        BoardPaint.paintStroke(h.target, ink);
        expect(h.ctx.fillStyle).toBe(entry.color);
      }
    }
  });

  it("keeps images fully opaque and uses the original bitmap in a dark mixed scene", () => {
    const h = context();
    const bitmap = {} as CanvasImageSource;
    const originalDraw = vi.spyOn(h.ctx, "drawImage");

    const image: ImageItem = {
      kind: "image",
      id: 2,
      asset: { id: "a", mime: "image/png", width: 10, height: 10, base64: "" },
      matrix: [1, 0, 0, 1, 0, 0],
    };

    BoardPaint.paintStrokes(h.target, [marker, image], () => bitmap, "dark");
    expect(h.alphas).toEqual([0.3, 1]);
    expect(originalDraw).toHaveBeenCalledWith(bitmap, 0, 0, 10, 10);
  });

  it("paints images fully opaque after a translucent highlighter in PNG and ordinary scenes", () => {
    const h = context();

    const image: ImageItem = {
      kind: "image",
      id: 2,
      asset: { id: "a", mime: "image/png", width: 10, height: 10, base64: "" },
      matrix: [1, 0, 0, 1, 0, 0],
    };

    BoardPaint.paintStrokes(
      h.target,
      [marker, image],
      () => ({}) as CanvasImageSource,
    );

    expect(h.alphas).toEqual([0.3, 1]);
  });

  it("uses analytical ellipse drawing and restores highlighter alpha after a template", () => {
    const h = context();

    const template: TemplateItem = {
      kind: "template",
      id: 2,
      generatorVersion: 1,
      template: BoardTemplates.defaults("ellipse"),
      matrix: [1, 0, 0, 1, 0, 0],
    };

    BoardPaint.paintStrokes(h.target, [marker, template, { ...marker, id: 3 }]);
    expect(h.ctx.ellipse).toHaveBeenCalledOnce();
    expect(h.alphas).toEqual([0.3, 1, 0.3]);
  });
});
