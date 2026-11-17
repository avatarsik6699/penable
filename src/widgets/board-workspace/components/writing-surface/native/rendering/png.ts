import { Messages } from "~/shared/lib/messages";
import { PNGDimensions } from "./png-dimensions";
import { RasterJob } from "./raster-job";
import { BoardPaths } from "./path-cache";
import { BoardPaint } from "./paint";
import { BoardRegions } from "~/entities/board";
import type { ClipMask, BoardItem } from "~/entities/board";

async function selectionPNG(
  strokes: readonly BoardItem[],
  region?: ClipMask,
  images?: {
    ready: (items: readonly BoardItem[]) => Promise<void>;
    get: (
      asset: import("~/entities/board").ImageAsset,
    ) => CanvasImageSource | null;
  },
): Promise<Blob> {
  await images?.ready(strokes);

  const bounds = region
    ? BoardRegions.maskBounds(region)
    : BoardRegions.visibleBounds(strokes);

  if (!bounds) throw Messages.error(Messages.create("selectContentFirst"));

  const padding = region ? 0 : 4;
  const size = PNGDimensions.ofBounds(bounds, padding);
  const canvas = document.createElement("canvas");

  canvas.width = size.width;
  canvas.height = size.height;

  try {
    const context = canvas.getContext("2d");

    if (!context)
      throw Messages.error(Messages.create("couldNotCreatePngCanvas2dIs"));

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

    BoardPaint.paintStrokes(context, strokes, images?.get, "light");

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(Messages.error(Messages.create("couldNotCreatePng"))),
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

export const BoardPNG = {
  pngDimensions: PNGDimensions.ofBounds,
  selectionPNG,
  downloadPNG,
  fragmentPNG: async (fragment: Promise<Blob>, signal: AbortSignal) =>
    RasterJob.render(await fragment, signal),
};
