import { BoardTemplates, type TemplateItem } from "~/entities/board";
import type { RenderingContext } from "./rendering-context.types";

function paint(ctx: RenderingContext, item: TemplateItem) {
  ctx.save();

  try {
    ctx.globalAlpha = 1;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const primitive of BoardTemplates.layout(item.template).primitives) {
      if (primitive.kind === "text") {
        ctx.fillStyle = primitive.color;
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
          ctx.fillStyle = primitive.fill;
          ctx.fill();
        }

        ctx.strokeStyle = primitive.color;
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
