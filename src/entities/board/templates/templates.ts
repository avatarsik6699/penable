import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { TemplateConfig, TemplateItem } from "../board.types";
import { LegacyTemplates } from "./legacy-templates";
import { MathLayout } from "./modules/math-layout";
import type { TemplateLayout } from "./templates.types";

function version(config: TemplateConfig): TemplateItem["generatorVersion"] {
  return config.kind === "axes" ||
    config.kind === "number-line" ||
    config.kind === "circle"
    ? 2
    : 1;
}

function validate(
  config: TemplateConfig,
  generatorVersion: 1 | 2 = 1,
): MessageTypes.Value {
  if (generatorVersion === 1) return LegacyTemplates.validate(config);

  if (generatorVersion !== 2) return Messages.create("unknownTemplateVersion");

  if (version(config) !== 2) return LegacyTemplates.validate(config);

  const base = LegacyTemplates.validate({
    ...config,
    kind: "rectangle",
    width: 320,
    height: 320,
  });

  if (base) return base;

  if (
    ![config.width, config.height].every(
      (n) => Number.isFinite(n) && n >= 40 && n <= 32768,
    )
  )
    return Messages.create("sizeMustBeBetween40And32");

  try {
    MathLayout.measure(config);

    return "";
  } catch (error) {
    return error instanceof Error
      ? Messages.from(error)
      : Messages.create("checkTheRangeAndStep");
  }
}

function layout(
  config: TemplateConfig,
  generatorVersion: 1 | 2 = 1,
): TemplateLayout {
  if (generatorVersion === 1) return LegacyTemplates.layout(config);

  const known = generatorVersion === 2 ? MathLayout.cached(config) : undefined;

  if (known) return known;

  const error = validate(config, generatorVersion);

  if (error) throw Messages.error(error);

  return version(config) === 2
    ? MathLayout.layout(config)
    : LegacyTemplates.layout(config);
}

function prepare(config: TemplateConfig): TemplateConfig {
  if (version(config) === 1) return config;

  const error = validate(config, 2);

  if (error) throw Messages.error(error);

  const m = MathLayout.measure(config);

  return { ...config, width: m.width, height: m.height };
}

function origin(
  config: TemplateConfig,
  generatorVersion: 1 | 2,
): {
  x: number;
  y: number;
} {
  return generatorVersion === 2 && version(config) === 2
    ? MathLayout.layout(config).origin
    : { x: config.width / 2, y: config.height / 2 };
}

function workload(config: TemplateConfig, generatorVersion: 1 | 2): number {
  if (generatorVersion === 1) return 0;

  if (config.kind === "circle") return 600;

  if (version(config) === 1) return 0;

  const ticks = Math.min(
    201,
    Math.max(2, Math.ceil((config.max - config.min) / config.step) + 1),
  );

  return ticks * (config.kind === "axes" ? 2 : 1) * (config.numbers ? 64 : 4);
}

export const BoardTemplates = {
  ...LegacyTemplates,
  version,
  validate,
  layout,
  prepare,
  origin,
  workload,
};
