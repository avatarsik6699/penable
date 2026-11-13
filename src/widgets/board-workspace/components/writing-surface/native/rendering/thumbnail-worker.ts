import { PNGDimensions } from "./png-dimensions";
import { BoardPaths } from "./path-cache";
import { BoardRegions } from "~/entities/board";
import { DocumentCodec, FragmentCodec } from "~/features/board-document/worker";
import { BoardViewport } from "~/entities/board";
import { BitmapCache } from "../images/worker";
import { BoardPaint } from "./paint";

const host = self as unknown as {
  onmessage:
    | ((
        event: MessageEvent<{ blob: Blob; mode: "selection" | "thumbnail" }>,
      ) => void)
    | null;
  postMessage: (value: { blob?: Blob; error?: string }) => void;
};

host.onmessage = ({ data }) => {
  void (async () => {
    const images = new BitmapCache(),
      canvas = new OffscreenCanvas(256, 160);

    try {
      if (data.blob.size > DocumentCodec.DOCUMENT_LIMITS.bytes)
        throw new Error("Предпросмотр превышает предел документа.");

      const text = await data.blob.text(),
        fragment = data.mode === "selection" ? FragmentCodec.parse(text) : null;

      const document = fragment
        ? { ...DocumentCodec.emptyDocument(), strokes: fragment.strokes }
        : DocumentCodec.parseDocumentJSON(text);

      const bounds = fragment
        ? BoardRegions.maskBounds(fragment.region ?? [])
        : null;

      if (fragment && !bounds) throw new Error("Область выделения пуста.");

      if (bounds) {
        const size = PNGDimensions.ofBounds(bounds, 0);

        canvas.width = size.width;
        canvas.height = size.height;
      }

      const context = canvas.getContext("2d");

      if (!context) throw new Error("Canvas 2D недоступен.");

      await images.ready(document.strokes);

      const view = document.lastWritingView
        ? BoardViewport.restoreWritingView(document.lastWritingView, 256, 160)
        : document.strokes.length
          ? BoardViewport.fitAll(document.strokes, 256, 160)
          : document.viewport;

      if (bounds) {
        context.setTransform(2, 0, 0, 2, -bounds.left * 2, -bounds.top * 2);

        BoardPaths.traceMask(context, fragment!.region!);

        context.clip("nonzero");
      } else context.setTransform(view.zoom, 0, 0, view.zoom, view.x, view.y);

      BoardPaint.paintStrokes(context, document.strokes, images.get);

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
