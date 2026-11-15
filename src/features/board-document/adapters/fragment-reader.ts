import { Messages } from "~/shared/lib/messages";
import type {
  BoardItem,
  SelectionClipboard,
  ImageAsset,
  Stroke,
} from "~/entities/board";
import { FragmentCodec } from "../modules/fragments";
import type { FragmentReaderTypes } from "./fragment-reader.types";

export const FragmentReader = {
  read(blob: Blob, signal: AbortSignal): Promise<SelectionClipboard> {
    if (blob.size > FragmentCodec.LIMIT)
      return Promise.reject(
        Messages.error(Messages.create("fragmentExceeds64Mib")),
      );

    if (signal.aborted)
      return Promise.reject(Messages.error(Messages.create("pasteCancelled")));

    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./fragment-reader-worker.ts", import.meta.url),
        { type: "module" },
      );

      const strokes: BoardItem[] = [],
        assets = new Map<string, ImageAsset>(),
        chunks = new Map<string, string[]>();

      const finish = () => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
      };

      const abort = () => {
        finish();
        reject(Messages.error(Messages.create("pasteCancelled")));
      };

      signal.addEventListener("abort", abort, { once: true });

      worker.onerror = (event) => {
        event.preventDefault();
        finish();

        reject(
          Messages.error(Messages.create("couldNotReadThePenableFragment")),
        );
      };

      worker.onmessage = ({
        data,
      }: MessageEvent<FragmentReaderTypes.Response>) => {
        if (signal.aborted) return;

        if (data.type === "error") {
          finish();
          reject(Messages.error(data.message));
        }

        if (data.type === "asset") {
          const parts = chunks.get(data.asset.id) ?? [];

          parts.push(data.value);
          chunks.set(data.asset.id, parts);

          if (data.offset + data.value.length === data.length) {
            assets.set(data.asset.id, {
              ...data.asset,
              base64: parts.join(""),
            });

            chunks.delete(data.asset.id);
          }
        }

        if (data.type === "item") {
          if (data.item.kind === "image")
            strokes.push({
              ...data.item,
              asset: assets.get(data.item.assetId)!,
            });
          else if (data.item.kind === "template") strokes.push(data.item);
          else strokes.push({ ...data.item, points: [] } as Stroke);
        }

        if (data.type === "points") {
          const stroke = strokes.at(-1);

          if (stroke && stroke.kind !== "image" && stroke.kind !== "template") {
            for (let i = 0; i < data.values.length; i += 4)
              stroke.points.push({
                x: data.values[i]!,
                y: data.values[i + 1]!,
                pressure: data.values[i + 2]!,
                time: data.values[i + 3]!,
              });
          }
        }

        if (data.type === "done") {
          finish();
          resolve({ strokes, region: data.region });
        }
      };

      worker.postMessage(blob);
    });
  },
};
