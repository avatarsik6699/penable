import { type StrokeGeometry } from "../geometry";
import type { AffineMatrix } from "../board.types";

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type CachedStroke = {
  bounds: Bounds | null;
  inverse?: AffineMatrix;
  geometry?: StrokeGeometry;
};

export type { Bounds, CachedStroke };
