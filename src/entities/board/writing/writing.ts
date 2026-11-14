import {
  BoardConstants,
  type InkColor,
  type InkInstrument,
  type WritingSettings,
  type InstrumentSettings,
} from "../board.types";

const palette = [
  { color: BoardConstants.INK, label: "Тёмный" },
  { color: "#667085", label: "Серый" },
  { color: "#175cd3", label: "Синий" },
  { color: "#0ba5ec", label: "Голубой" },
  { color: "#0e9384", label: "Бирюзовый" },
  { color: "#2e7d32", label: "Зелёный" },
  { color: "#f4c430", label: "Жёлтый" },
  { color: "#e87518", label: "Оранжевый" },
  { color: "#d92d20", label: "Красный" },
  { color: "#7f56d9", label: "Фиолетовый" },
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
