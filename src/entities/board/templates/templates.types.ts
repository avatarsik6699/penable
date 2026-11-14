import type { Position, InkColor } from "../board.types";

export type TemplatePrimitive =
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      fill: InkColor | null;
      width: number;
      color: InkColor;
      dashed: boolean;
    }
  | {
      kind: "path";
      points: readonly Position[];
      closed: boolean;
      fill: InkColor | null;
      width: number;
      color: InkColor;
      dashed: boolean;
    }
  | {
      kind: "text";
      text: string;
      x: number;
      y: number;
      size: number;
      color: InkColor;
      width: number;
      height: number;
    };

export type TemplateLayout = {
  primitives: readonly TemplatePrimitive[];
  bounds: { left: number; top: number; right: number; bottom: number };
};
