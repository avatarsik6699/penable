import { BoardPaths } from "./path-cache";
import { BoardPaint } from "./paint";
import { type InkBounds, BoardRegions } from "~/entities/board";
import type { ClipMask, Stroke } from "~/entities/board";
function pngDimensions(
  bounds: InkBounds,
  padding = 4,
): {
  width: number;
  height: number;
} {
  const width = Math.max(
    1,
    Math.ceil((bounds.right - bounds.left) * 2) + padding,
  );
  const height = Math.max(
    1,
    Math.ceil((bounds.bottom - bounds.top) * 2) + padding,
  );
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16777216
  ) {
    throw new Error(
      "PNG превышает предел 8192 px по стороне или 16 777 216 пикселей. Выделите меньший фрагмент.",
    );
  }
  return { width, height };
}
async function selectionPNG(
  strokes: readonly Stroke[],
  region?: ClipMask,
): Promise<Blob> {
  const bounds = region
    ? BoardRegions.maskBounds(region)
    : BoardRegions.visibleBounds(strokes);
  if (!bounds) throw new Error("Сначала выделите записи.");
  const padding = region ? 0 : 4;
  const size = pngDimensions(bounds, padding);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  try {
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Не удалось создать PNG: Canvas 2D недоступен.");
    context.setTransform(
      2,
      0,
      0,
      2,
      padding / 2 - bounds.left * 2,
      padding / 2 - bounds.top * 2,
    );
    if (region) {
      BoardPaths.traceMask(context, region);
      context.clip("nonzero");
    }
    BoardPaint.paintStrokes(context, strokes);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("Не удалось создать PNG.")),
        "image/png",
      ),
    );
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}
function downloadPNG(blob: Blob) {
  const url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "penable-selection.png";
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
function writePNG(png: Promise<Blob>): Promise<void> {
  try {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write)
      throw new Error("Системный буфер недоступен.");
    return navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
  } catch (error) {
    return Promise.reject(error);
  }
}

export const BoardPNG = { pngDimensions, selectionPNG, downloadPNG, writePNG };
