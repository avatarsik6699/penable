import type { BoardDocument } from "../board-document.types";
import { ImageAssets } from "../modules/image-assets";

async function validate(
  document: BoardDocument,
  signal: AbortSignal,
): Promise<void> {
  for (const asset of ImageAssets.unique(document.strokes)) {
    if (signal.aborted) throw new Error("Проверка изображений отменена.");

    const bytes = ImageAssets.decodeBase64(asset.base64);

    const bitmap = await createImageBitmap(
      new Blob([bytes as BlobPart], { type: asset.mime }),
    );

    try {
      if (signal.aborted) throw new Error("Проверка изображений отменена.");

      ImageAssets.dimensions(bitmap.width, bitmap.height);

      if (!(bitmap.width === asset.width && bitmap.height === asset.height))
        throw new Error("Размер изображения не совпадает с заголовком.");
    } finally {
      bitmap.close();
    }
  }
}

export const ImagePreflight = { validate };
