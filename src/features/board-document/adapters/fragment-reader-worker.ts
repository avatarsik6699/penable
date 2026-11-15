import { Messages } from "~/shared/lib/messages";
import { ImagePreflight } from "./image-preflight";
import { DocumentCodec } from "../modules/codec";
import { FragmentCodec } from "../modules/fragments";
import type { FragmentReaderTypes } from "./fragment-reader.types";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<Blob>) => void) | null;
  postMessage: (
    message: FragmentReaderTypes.Response,
    transfer?: Transferable[],
  ) => void;
};

host.onmessage = ({ data }) => {
  void (async () => {
    try {
      if (data.size > FragmentCodec.LIMIT)
        throw Messages.error(Messages.create("fragmentExceeds64Mib"));

      const fragment = FragmentCodec.parse(await data.text()),
        assets = new Set<string>();

      try {
        await ImagePreflight.validate(
          { ...DocumentCodec.emptyDocument(), strokes: fragment.strokes },
          new AbortController().signal,
        );
      } catch {
        throw Messages.error(Messages.create("couldNotDecodeTheFragmentImage"));
      }

      for (const item of fragment.strokes) {
        if (item.kind === "image") {
          if (!assets.has(item.asset.id)) {
            const { base64, ...asset } = item.asset;

            for (let offset = 0; offset < base64.length; offset += 65536)
              host.postMessage({
                type: "asset",
                asset,
                value: base64.slice(offset, offset + 65536),
                offset,
                length: base64.length,
              });

            assets.add(item.asset.id);
          }

          const { asset, ...metadata } = item;

          host.postMessage({
            type: "item",
            item: { ...metadata, assetId: asset.id },
          });
        } else if (item.kind === "template") {
          host.postMessage({ type: "item", item });
        } else {
          const { points, ...metadata } = item;

          host.postMessage({ type: "item", item: metadata });

          for (let offset = 0; offset < points.length; offset += 2048) {
            const chunk = points.slice(offset, offset + 2048),
              values = new Float64Array(chunk.length * 4);

            chunk.forEach((p, i) =>
              values.set([p.x, p.y, p.pressure, p.time], i * 4),
            );

            host.postMessage({ type: "points", values }, [values.buffer]);
          }
        }
      }

      host.postMessage({ type: "done", region: fragment.region ?? [] });
    } catch (error) {
      host.postMessage({
        type: "error",
        message:
          error instanceof Error
            ? Messages.from(error)
            : Messages.create("invalidPenableFragment"),
      });
    }
  })();
};
