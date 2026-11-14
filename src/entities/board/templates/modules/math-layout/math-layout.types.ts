import type { TemplateConfig } from "../../../board.types";
import type { TemplateLayout, TemplatePrimitive } from "../../templates.types";

export type MathMeasure = {
  ticks: readonly number[];
  spacing: number;
  width: number;
  height: number;
  margin: number;
};

export type MathBuilder = {
  config: TemplateConfig;
  primitives: TemplatePrimitive[];
  line: (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashed?: boolean,
    width?: number,
  ) => void;
  arrow: (x1: number, y1: number, x2: number, y2: number) => void;
  label: (
    text: string,
    x: number,
    y: number,
    alignX?: -1 | 0 | 1,
    alignY?: -1 | 0 | 1,
  ) => void;
};

export type MathResult = TemplateLayout & { origin: { x: number; y: number } };
