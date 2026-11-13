import type { InkBounds } from "~/entities/board";

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

export const PNGDimensions = { ofBounds: pngDimensions };
