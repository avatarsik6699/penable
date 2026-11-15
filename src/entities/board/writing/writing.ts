import { Messages } from "~/shared/lib/messages";
import {
  BoardConstants,
  type InkColor,
  type InkInstrument,
  type WritingSettings,
  type InstrumentSettings,
} from "../board.types";

const palette = [
  { color: BoardConstants.INK, label: Messages.create("dark") },
  { color: "#667085", label: Messages.create("gray") },
  { color: "#175cd3", label: Messages.create("blue") },
  { color: "#0ba5ec", label: Messages.create("lightBlue") },
  { color: "#0e9384", label: Messages.create("teal") },
  { color: "#2e7d32", label: Messages.create("green") },
  { color: "#f4c430", label: Messages.create("yellow") },
  { color: "#e87518", label: Messages.create("orange") },
  { color: "#d92d20", label: Messages.create("red") },
  { color: "#7f56d9", label: Messages.create("purple") },
] as const;

const instruments = ["pen", "pressure", "highlighter"] as const;

function defaults(width = 3, stabilization = 65): WritingSettings {
  const pen = {
    color: BoardConstants.INK,
    width,
    stabilization,
    opacity: 1,
    pressureStrength: 65,
  };

  return {
    instrument: "pen",
    instruments: {
      pen,
      pressure: { ...pen },
      highlighter: { ...pen, color: "#f4c430", width: 20, opacity: 0.3 },
    },
  };
}

function isColor(value: unknown): value is InkColor {
  return palette.some((p) => p.color === value);
}

function isInstrument(value: unknown): value is InkInstrument {
  return instruments.some((i) => i === value);
}

function validSettings(
  value: InstrumentSettings,
  instrument: InkInstrument,
): boolean {
  return (
    isColor(value.color) &&
    Number.isFinite(value.width) &&
    value.width >= (instrument === "highlighter" ? 4 : 0.5) &&
    value.width <= (instrument === "highlighter" ? 64 : 12) &&
    Number.isFinite(value.stabilization) &&
    value.stabilization >= 0 &&
    value.stabilization <= 100 &&
    Number.isFinite(value.pressureStrength) &&
    value.pressureStrength >= 0 &&
    value.pressureStrength <= 100 &&
    Number.isFinite(value.opacity) &&
    (instrument === "highlighter"
      ? value.opacity >= 0.1 && value.opacity <= 0.7
      : value.opacity === 1)
  );
}

function clone(value: WritingSettings): WritingSettings {
  return {
    instrument: value.instrument,
    instruments: {
      pen: { ...value.instruments.pen },
      pressure: { ...value.instruments.pressure },
      highlighter: { ...value.instruments.highlighter },
    },
  };
}

export const BoardWriting = {
  palette,
  instruments,
  defaults,
  isColor,
  isInstrument,
  validSettings,
  clone,
};
