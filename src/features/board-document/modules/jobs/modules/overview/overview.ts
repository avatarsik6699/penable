import { BoardRegions, type InkBounds, type Stroke } from "~/entities/board";
import type { OverviewResult } from "./overview.types";

const WIDTH = 256;
const HEIGHT = 160;

function build(strokes: readonly Stroke[]): OverviewResult {
  const items: InkBounds[] = [];
  let bounds: InkBounds | null = null;

  for (const stroke of strokes) {
    const value = BoardRegions.visibleBounds([stroke]);

    if (!value) continue;

    items.push(value);

    bounds = bounds
      ? {
          left: Math.min(bounds.left, value.left),
          right: Math.max(bounds.right, value.right),
          top: Math.min(bounds.top, value.top),
          bottom: Math.max(bounds.bottom, value.bottom),
        }
      : { ...value };
  }

  const values = new Uint8Array(WIDTH * HEIGHT);

  if (!bounds) return { width: WIDTH, height: HEIGHT, values, bounds: null };

  const padding = Math.max(
    24,
    Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top) * 0.05,
  );

  bounds = {
    left: bounds.left - padding,
    right: bounds.right + padding,
    top: bounds.top - padding,
    bottom: bounds.bottom + padding,
  };

  const stride = WIDTH + 1;
  const difference = new Int32Array(stride * (HEIGHT + 1));

  for (const item of items) {
    const x0 = Math.max(
      0,
      Math.min(
        WIDTH - 1,
        Math.floor(
          ((item.left - bounds.left) / (bounds.right - bounds.left)) * WIDTH,
        ),
      ),
    );

    const x1 = Math.min(
      WIDTH,
      Math.max(
        x0 + 1,
        Math.ceil(
          ((item.right - bounds.left) / (bounds.right - bounds.left)) * WIDTH,
        ),
      ),
    );

    const y0 = Math.max(
      0,
      Math.min(
        HEIGHT - 1,
        Math.floor(
          ((item.top - bounds.top) / (bounds.bottom - bounds.top)) * HEIGHT,
        ),
      ),
    );

    const y1 = Math.min(
      HEIGHT,
      Math.max(
        y0 + 1,
        Math.ceil(
          ((item.bottom - bounds.top) / (bounds.bottom - bounds.top)) * HEIGHT,
        ),
      ),
    );

    difference[y0 * stride + x0]!++;
    difference[y0 * stride + x1]!--;
    difference[y1 * stride + x0]!--;
    difference[y1 * stride + x1]!++;
  }

  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++) {
      const i = y * stride + x;

      const value =
        difference[i]! +
        (x ? difference[i - 1]! : 0) +
        (y ? difference[i - stride]! : 0) -
        (x && y ? difference[i - stride - 1]! : 0);

      difference[i] = value;

      values[y * WIDTH + x] = value
        ? Math.min(255, 100 + Math.round(Math.log2(value + 1) * 40))
        : 0;
    }

  return { width: WIDTH, height: HEIGHT, values, bounds };
}

export const DocumentOverview = { build };
