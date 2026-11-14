import type { TemplateConfig } from "../board.types";
import { BoardTemplates } from "./templates";

function recommend(
  config: TemplateConfig,
  generatorVersion: 1 | 2 = 1,
): number | null {
  const span = config.max - config.min;

  if (!Number.isFinite(span) || span <= 0) return null;

  // A fixed candidate budget keeps hostile ranges away from tick enumeration.
  for (let exponent = -6; exponent <= 5; exponent++) {
    for (const factor of [1, 2, 5]) {
      const step = Number((factor * 10 ** exponent).toPrecision(12));

      if (step < span / 10) continue;

      const first = Math.ceil(config.min / step) * step;
      const last = Math.floor(config.max / step) * step;

      if (last <= first) continue;

      if (!BoardTemplates.validate({ ...config, step }, generatorVersion))
        return step;
    }
  }

  return null;
}

export const BoardTemplateSteps = { recommend };
