import type { TemplateConfig } from "../../../board.types";
import type { TemplatePrimitive } from "../../templates.types";
import { TemplateGlyphs } from "../glyphs";
import { MathMeasure } from "./math-measure";
import type { MathBuilder as MathBuilderPorts } from "./math-layout.types";

function create(config: TemplateConfig): MathBuilderPorts {
  const primitives: TemplatePrimitive[] = [];

  const line: MathBuilderPorts["line"] = (
    x1,
    y1,
    x2,
    y2,
    dashed = false,
    width = config.lineWidth,
  ) => {
    primitives.push({
      kind: "path",
      points: [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      closed: false,
      fill: null,
      width,
      color: config.color,
      dashed,
    });
  };

  const arrow: MathBuilderPorts["arrow"] = (x1, y1, x2, y2) => {
    line(x1, y1, x2, y2);

    const angle = Math.atan2(y2 - y1, x2 - x1);

    line(
      x2 - 9 * Math.cos(angle - 0.45),
      y2 - 9 * Math.sin(angle - 0.45),
      x2,
      y2,
    );

    line(
      x2 - 9 * Math.cos(angle + 0.45),
      y2 - 9 * Math.sin(angle + 0.45),
      x2,
      y2,
    );
  };

  const label: MathBuilderPorts["label"] = (
    text,
    x,
    y,
    alignX = 0,
    alignY = 0,
  ) => {
    const run = TemplateGlyphs.run(text, MathMeasure.SIZE);

    primitives.push({
      kind: "label",
      text,
      x: x - (run.width * (alignX + 1)) / 2,
      y: y - (run.height * (alignY + 1)) / 2,
      size: MathMeasure.SIZE,
      color: config.color,
      ...run,
    });
  };

  return { config, primitives, line, arrow, label };
}

export const MathBuilder = { create };
