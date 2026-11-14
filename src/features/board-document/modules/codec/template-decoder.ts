import { BoardTemplates, type TemplateConfig } from "~/entities/board";
import { CodecPrimitives } from "./document-codec.utils";

function decode(value: unknown): TemplateConfig {
  const raw = CodecPrimitives.object(value, "item.template");

  const result = {
    kind: raw.kind,
    width: raw.width,
    height: raw.height,
    color: raw.color,
    lineWidth: raw.lineWidth,
    dashed: raw.dashed,
    fill: raw.fill,
    min: raw.min,
    max: raw.max,
    step: raw.step,
    numbers: raw.numbers,
    grid: raw.grid,
    labels: raw.labels,
    rays: raw.rays,
  } as TemplateConfig;

  const error = BoardTemplates.validate(result);

  if (error) CodecPrimitives.invalid(`item.template: ${error}`);

  return Object.freeze(result);
}

export const TemplateDecoder = { decode };
