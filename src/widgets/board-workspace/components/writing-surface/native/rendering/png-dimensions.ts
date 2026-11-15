import { Messages } from "~/shared/lib/messages";
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
    throw Messages.error(Messages.create("pngExceeds8192PxPerSideOr"));
  }

  return { width, height };
}

export const PNGDimensions = { ofBounds: pngDimensions };
