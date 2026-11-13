import type { InkBounds } from "~/entities/board";

export type OverviewResult = {
  width: number;
  height: number;
  values: Uint8Array;
  bounds: InkBounds | null;
};
