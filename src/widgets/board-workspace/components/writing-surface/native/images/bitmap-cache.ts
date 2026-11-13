import type { ImageAsset, BoardItem } from "~/entities/board";
import type { BitmapCacheTypes } from "./bitmap-cache.types";
import { ImageAssets } from "~/features/board-document/worker";

export class BitmapCache {
  private entries = new Map<ImageAsset, BitmapCacheTypes.Entry>();
  private disposed = false;

  constructor(private readonly changed: () => void = () => {}) {}

  ensure(asset: ImageAsset): Promise<ImageBitmap> {
    if (this.disposed)
      return Promise.reject(new Error("Загрузка изображения отменена."));

    const known = this.entries.get(asset);

    if (known) return known.promise;

    if (asset.base64.length > Math.ceil(ImageAssets.LIMITS.bytes / 3) * 4)
      throw new Error("Изображение превышает 8 MiB.");

    // External assets pass the strict codec; file assets use our canonical encoder.
    // Re-decoding immutable bytes after undo uses the browser rather than a JS byte loop.
    const arrays = Uint8Array as unknown as BitmapCacheTypes.NativeArrayDecoder;

    const bytes = arrays.fromBase64
      ? arrays.fromBase64(asset.base64, { lastChunkHandling: "strict" })
      : ImageAssets.decodeBase64(asset.base64);

    ImageAssets.inspect(bytes);

    const blob = new Blob([bytes as BlobPart], { type: asset.mime });

    const entry = {
      promise: Promise.resolve(null as unknown as ImageBitmap),
      bitmap: null as ImageBitmap | null,
      claims: 0,
    };

    entry.promise = createImageBitmap(blob)
      .then((bitmap) => {
        if (this.disposed || this.entries.get(asset) !== entry) {
          bitmap.close();

          throw new Error("Загрузка изображения отменена.");
        }

        try {
          ImageAssets.dimensions(bitmap.width, bitmap.height);

          if (!(bitmap.width === asset.width && bitmap.height === asset.height))
            throw new Error(
              "Размер декодированного изображения не совпадает с заголовком.",
            );
        } catch (error) {
          bitmap.close();

          throw error;
        }

        entry.bitmap = bitmap;
        this.changed();

        return bitmap;
      })
      .catch((error) => {
        if (this.entries.get(asset) === entry) this.entries.delete(asset);

        throw error;
      });

    this.entries.set(asset, entry);

    return entry.promise;
  }

  claim(asset: ImageAsset): BitmapCacheTypes.Claim {
    const ready = this.ensure(asset),
      entry = this.entries.get(asset);

    if (entry) entry.claims++;

    let released = false;

    return {
      ready,

      release: (retain: boolean) => {
        if (released) return;

        released = true;

        if (!entry) return;

        entry.claims--;

        if (!retain && !entry.claims && this.entries.get(asset) === entry) {
          entry.bitmap?.close();
          this.entries.delete(asset);
        }
      },
    };
  }

  readonly get = (asset: ImageAsset): CanvasImageSource | null =>
    this.entries.get(asset)?.bitmap ?? null;

  async ready(items: readonly BoardItem[]): Promise<void> {
    await Promise.all(
      items.flatMap((item) =>
        item.kind === "image" ? [this.ensure(item.asset)] : [],
      ),
    );
  }

  retain(items: readonly BoardItem[]) {
    const used = new Set(
      items.flatMap((i) => (i.kind === "image" ? [i.asset] : [])),
    );

    for (const [asset, entry] of this.entries)
      if (!used.has(asset) && !entry.claims) {
        entry.bitmap?.close();
        this.entries.delete(asset);
      }
  }

  dispose() {
    this.disposed = true;

    for (const entry of this.entries.values()) entry.bitmap?.close();

    this.entries.clear();
  }
}
