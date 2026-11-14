import { describe, expect, it, vi } from "vitest";
import {
  BoardTemplates,
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
