import { RasterJob } from "./raster-job";
import type { BoardPreviewsTypes } from "~/features/board-document";

const render: BoardPreviewsTypes.Renderer = async (blob, signal) => {
  const rendered = await RasterJob.render(blob, "thumbnail", signal),
    url = URL.createObjectURL(rendered);

  let released = false;

  return {
    url,
    bytes: rendered.size,

    release: () => {
      if (!released) {
        released = true;
        URL.revokeObjectURL(url);
      }
    },
  };
};

export const BoardThumbnail = { render };
