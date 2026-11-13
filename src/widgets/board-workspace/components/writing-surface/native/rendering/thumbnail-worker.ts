import { PNGDimensions } from "./png-dimensions";
import { BoardPaths } from "./path-cache";
import { BoardRegions } from "~/entities/board";
import { DocumentCodec, FragmentCodec } from "~/features/board-document/worker";
import { BitmapCache } from "../images/worker";
import { BoardPaint } from "./paint";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<{ blob: Blob }>) => void) | null;
  postMessage: (value: { blob?: Blob; error?: string }) => void;
};

host.onmessage = ({ data }) => {
  void (async () => {
    const images = new BitmapCache(),
      canvas = new OffscreenCanvas(256, 160);

    try {
      if (data.blob.size > DocumentCodec.DOCUMENT_LIMITS.bytes)
        throw new Error("Предпросмотр превышает предел документа.");

      const fragment = FragmentCodec.parse(await data.blob.text());
      const bounds = BoardRegions.maskBounds(fragment.region ?? []);

      if (!bounds) throw new Error("Область выделения пуста.");

      const size = PNGDimensions.ofBounds(bounds, 0);

      canvas.width = size.width;
      canvas.height = size.height;

      const context = canvas.getContext("2d");

      if (!context) throw new Error("Canvas 2D недоступен.");

      await images.ready(fragment.strokes);

      context.setTransform(2, 0, 0, 2, -bounds.left * 2, -bounds.top * 2);
      BoardPaths.traceMask(context, fragment.region ?? []);
      context.clip("nonzero");

      BoardPaint.paintStrokes(context, fragment.strokes, images.get);

      const blob = await canvas.convertToBlob({ type: "image/png" });

      images.dispose();
      host.postMessage({ blob });
    } catch (error) {
      host.postMessage({
        error:
          error instanceof Error ? error.message : "Предпросмотр недоступен.",
      });
    } finally {
      images.dispose();
      canvas.width = 0;
      canvas.height = 0;
    }
  })();
};
