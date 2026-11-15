import { Messages } from "~/shared/lib/messages";
import type { TemplateConfig } from "../../../board.types";
import { TemplateGlyphs } from "../glyphs";
import type { MathMeasure as MeasuredMath } from "./math-layout.types";

const SIZE = 22;
const MAX_TICKS = 201;
const MAX_SIDE = 32768;

function format(value: number): string {
  return Number(value.toPrecision(12)).toString().replace("-", "−");
}

function measure(config: TemplateConfig): MeasuredMath {
  if (config.kind === "circle")
    return { ticks: [], spacing: 0, width: 480, height: 480, margin: 0 };

  const first = Math.ceil(config.min / config.step - 1e-9);
  const last = Math.floor(config.max / config.step + 1e-9);
  const count = last - first + 1;

  if (!Number.isFinite(count) || count < 2 || count > MAX_TICKS)
    throw Messages.error(Messages.create("use2To201TicksIncreaseThe"));

  const ticks = Array.from(
    { length: count },
    (_, index) => (first + index) * config.step,
  );

  const labels = config.numbers
    ? ticks.map((n) => TemplateGlyphs.run(format(n), SIZE))
    : [];

  const widest = Math.max(0, ...labels.map((label) => label.width));
  const spacing = Math.max(44, widest + 20);
  const margin = Math.max(48, widest + 18);
  const span = ((config.max - config.min) / config.step) * spacing;
  const width = span + margin * 2;
  const height = config.kind === "axes" ? width : 120;

  if (!Number.isFinite(width) || width > MAX_SIDE || height > MAX_SIDE)
    throw Messages.error(
      Messages.create("templateExceeds32768UnitsIncreaseThe"),
    );

  return { ticks, spacing, width, height, margin };
}

export const MathMeasure = { measure, format, SIZE, MAX_SIDE };
