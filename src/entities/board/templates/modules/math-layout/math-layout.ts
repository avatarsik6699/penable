import type { TemplateConfig } from "../../../board.types";
import { MathMeasure } from "./math-measure";
import { MathBuilder } from "./math-builder";
import { MathCircle } from "./math-circle";
import type { MathResult } from "./math-layout.types";

const cache = new WeakMap<TemplateConfig, MathResult>();

function layout(config: TemplateConfig): MathResult {
  const known = cache.get(config);

  if (known) return known;

  const m = MathMeasure.measure(config),
    b = MathBuilder.create(config);

  let origin: { x: number; y: number };

  if (config.kind === "circle") origin = MathCircle.build(b);
  else {
    const unit = m.spacing / config.step;

    const px = (n: number) => m.margin + (n - config.min) * unit;

    const py = (n: number) => m.height - m.margin - (n - config.min) * unit;

    const axisY = config.kind === "axes" ? py(0) : 44;
    const axisX = px(0);

    origin = { x: axisX, y: axisY };

    if (config.grid && config.kind === "axes")
      for (const n of m.ticks) {
        if (Math.abs(n) < 1e-10) continue;

        b.line(px(n), m.margin, px(n), m.height - m.margin, true, 0.5);
        b.line(m.margin, py(n), m.width - m.margin, py(n), true, 0.5);
      }

    b.arrow(m.margin - 16, axisY, m.width - m.margin + 26, axisY);
    b.label("x", m.width - m.margin + 26, axisY - 16);

    if (config.kind === "axes") {
      b.arrow(axisX, m.height - m.margin + 16, axisX, m.margin - 26);
      b.label("y", axisX + 16, m.margin - 26);
    }

    for (const n of m.ticks) {
      b.line(px(n), axisY - 5, px(n), axisY + 5);

      if (config.numbers && Math.abs(n) > 1e-10)
        b.label(MathMeasure.format(n), px(n), axisY + 14, 0, -1);

      if (config.kind === "axes") {
        b.line(axisX - 5, py(n), axisX + 5, py(n));

        if (config.numbers && Math.abs(n) > 1e-10)
          b.label(MathMeasure.format(n), axisX - 14, py(n), 1, 0);
      }
    }

    if (config.numbers) b.label("0", axisX - 14, axisY + 14, 1, -1);
  }

  const padding = config.lineWidth / 2;

  const result: MathResult = {
    primitives: b.primitives,
    bounds: {
      left: -padding,
      top: -padding,
      right: m.width + padding,
      bottom: m.height + padding,
    },
    origin,
  };

  cache.set(config, result);

  return result;
}

export const MathLayout = {
  layout,
  measure: MathMeasure.measure,
  cached: (config: TemplateConfig) => cache.get(config),
};
