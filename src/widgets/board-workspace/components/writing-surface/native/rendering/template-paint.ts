import { Theme, type ThemeTypes } from "~/shared/lib/theme";
import { BoardTemplates, type TemplateItem } from "~/entities/board";
import type { RenderingContext } from "./rendering-context.types";

const glyphPaths = new Map<string, Path2D>();

function paint(
  ctx: RenderingContext,
  item: TemplateItem,
  theme: ThemeTypes.Effective = "light",
) {
  ctx.save();

  try {
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const primitive of BoardTemplates.layout(
      item.template,
      item.generatorVersion,
    ).primitives) {
      if (primitive.kind === "label") {
        ctx.fillStyle = Theme.color(primitive.color, theme);

        for (const glyph of primitive.glyphs) {
          let path = glyphPaths.get(glyph.path);

          if (!path) {
            path = new Path2D(glyph.path);
            glyphPaths.set(glyph.path, path);
          }

          ctx.save();

          ctx.transform(
            glyph.scale,
            0,
            0,
            glyph.scale,
            primitive.x + glyph.x,
            primitive.y + glyph.y,
          );

          ctx.fill(path);
          ctx.restore();
        }
      } else if (primitive.kind === "text") {
        ctx.fillStyle = Theme.color(primitive.color, theme);
        ctx.font = `${primitive.size}px Arial, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(primitive.text, primitive.x, primitive.y, primitive.width);
      } else {
        ctx.beginPath();

        if (primitive.kind === "ellipse")
          ctx.ellipse(
            primitive.cx,
            primitive.cy,
            primitive.rx,
            primitive.ry,
            0,
            0,
            Math.PI * 2,
          );
        else {
          for (let i = 0; i < primitive.points.length; i++) {
            const point = primitive.points[i]!;

            if (i === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          }

          if (primitive.closed) ctx.closePath();
        }

        if (primitive.fill) {
          ctx.fillStyle = Theme.color(primitive.fill, theme);
          ctx.fill();
        }

        ctx.strokeStyle = Theme.color(primitive.color, theme);
        ctx.lineWidth = primitive.width;

        ctx.setLineDash(
          primitive.dashed ? [primitive.width * 3, primitive.width * 2] : [],
        );

        ctx.stroke();
      }
    }
  } finally {
    ctx.restore();
  }
}

export const TemplatePaint = { paint };
