import { type StrokeGeometry } from "../geometry";

type Bounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type CachedStroke = {
  bounds: Bounds;
  geometry?: StrokeGeometry;
};

export type { Bounds, CachedStroke };
