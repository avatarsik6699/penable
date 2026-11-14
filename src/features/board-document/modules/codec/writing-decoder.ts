import {
  BoardWriting,
  type InkStyle,
  type WritingSettings,
  type InkInstrument,
  type InstrumentSettings,
} from "~/entities/board";
import { CodecPrimitives } from "./document-codec.utils";

function style(value: unknown): InkStyle {
  const raw = CodecPrimitives.object(value, "stroke.style");

  if (!BoardWriting.isInstrument(raw.instrument))
    return CodecPrimitives.invalid("stroke.style.instrument");

  const result = {
    instrument: raw.instrument,
    opacity: CodecPrimitives.number(
      raw.opacity,
      0.1,
      1,
      "stroke.style.opacity",
    ),
    pressureStrength: CodecPrimitives.number(
      raw.pressureStrength,
      0,
      100,
      "stroke.style.pressureStrength",
    ),
  };

  if (
    (result.instrument !== "highlighter" && result.opacity !== 1) ||
    (result.instrument === "highlighter" && result.opacity > 0.7)
  )
    CodecPrimitives.invalid("stroke.style.opacity");

  return Object.freeze(result);
}

function settings(
  value: unknown,
  instrument: InkInstrument,
): InstrumentSettings {
  const raw = CodecPrimitives.object(value, `tools.writing.${instrument}`);

  const result = {
    color: raw.color,
    width: raw.width,
    stabilization: raw.stabilization,
    opacity: raw.opacity,
    pressureStrength: raw.pressureStrength,
  } as InstrumentSettings;

  if (!BoardWriting.validSettings(result, instrument))
    CodecPrimitives.invalid(`tools.writing.${instrument}`);

  return Object.freeze({ ...result });
}

function writing(value: unknown): WritingSettings {
  const raw = CodecPrimitives.object(value, "tools.writing");

  if (!BoardWriting.isInstrument(raw.instrument))
    return CodecPrimitives.invalid("tools.writing.instrument");

  const profiles = CodecPrimitives.object(
    raw.instruments,
    "tools.writing.instruments",
  );

  return Object.freeze({
    instrument: raw.instrument,
    instruments: Object.freeze({
      pen: settings(profiles.pen, "pen"),
      pressure: settings(profiles.pressure, "pressure"),
      highlighter: settings(profiles.highlighter, "highlighter"),
    }),
  });
}

export const WritingDecoder = { style, writing };
