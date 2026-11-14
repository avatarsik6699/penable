import type { PressureDisc } from "./pressure-outline.types";
import type { Position } from "../board.types";

export type RibbonSection = {
  point: PressureDisc;
  left: Position;
  right: Position;
  angle: number;
};

export type PressureRibbonGeometry = {
  chunks: readonly (readonly RibbonSection[])[];
  tail: readonly RibbonSection[];
  first: RibbonSection;
  last: RibbonSection;
} | null;

export type PressureRibbon = {
  left: readonly Position[];
  right: readonly Position[];
  first: PressureDisc;
  last: PressureDisc;
  startAngle: number;
  endAngle: number;
} | null;
