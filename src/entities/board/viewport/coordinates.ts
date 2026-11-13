import type { Point, PointerSample, Viewport } from "../board.types";
import { BoardViewport } from "./viewport";

export type SurfaceBounds = {
  left: number;
  top: number;
};

// Scene units are CSS pixels. Only the renderer knows the bitmap's DPR.
function toScenePoint(
  sample: PointerSample,
  bounds: SurfaceBounds,
  viewport: Viewport = BoardViewport.initialViewport(),
): Point | null {
  const x = sample.clientX - bounds.left;
  const y = sample.clientY - bounds.top;

  if (![x, y, sample.pressure, sample.timeStamp].every(Number.isFinite))
    return null;

  const world = BoardViewport.screenToWorld({ x, y }, viewport);

  if (!Number.isFinite(world.x) || !Number.isFinite(world.y)) return null;

  return { ...world, pressure: sample.pressure, time: sample.timeStamp };
}

function validDpr(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1;
}

const BITMAP_PIXEL_BUDGET = 16777216;
const BITMAP_SIDE_LIMIT = 8192;
const CANVAS_LAYERS = 2;

function bitmapSize(
  width: number,
  height: number,
  dpr: number,
  nativeScale = 1,
) {
  const cssWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const cssHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const requestedRatio = validDpr(validDpr(dpr) * validDpr(nativeScale));
  const maxPixels = BITMAP_PIXEL_BUDGET / CANVAS_LAYERS;

  const ratio = Math.min(
    requestedRatio,
    BITMAP_SIDE_LIMIT / cssWidth,
    BITMAP_SIDE_LIMIT / cssHeight,
    Math.sqrt(maxPixels / cssWidth / cssHeight),
  );

  const bitmapWidth = Math.max(
    1,
    Math.min(BITMAP_SIDE_LIMIT, Math.round(cssWidth * ratio)),
  );

  const bitmapHeight = Math.max(
    1,
    Math.min(
      BITMAP_SIDE_LIMIT,
      Math.round(cssHeight * ratio),
      Math.floor(maxPixels / bitmapWidth),
    ),
  );

  const scaleX = bitmapWidth / cssWidth;
  const scaleY = bitmapHeight / cssHeight;

  return {
    width: bitmapWidth,
    height: bitmapHeight,
    scaleX,
    scaleY,
    requestedRatio,
    effectiveRatio: Math.min(scaleX, scaleY),
    capped: ratio < requestedRatio,
    totalPixels: bitmapWidth * bitmapHeight * CANVAS_LAYERS,
  };
}

export const BoardCoordinates = {
  toScenePoint,
  validDpr,
  BITMAP_PIXEL_BUDGET,
  BITMAP_SIDE_LIMIT,
  CANVAS_LAYERS,
  bitmapSize,
};
