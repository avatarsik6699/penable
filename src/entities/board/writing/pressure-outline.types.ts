import type { Position } from "../board.types";

export type PressureDisc = Position & { radius: number };

export type PressureSegment = { a: PressureDisc; b: PressureDisc };

export type PressureOutline = {
  revision: number;
  readonly stable: readonly PressureSegment[];
  readonly tail: readonly PressureSegment[];
  readonly first: PressureDisc | null;
};
