import { Messages } from "~/shared/lib/messages";
import type { BoardDocument } from "../board-document.types";
import { ImageAssets } from "../modules/image-assets";

async function validate(
  document: BoardDocument,
  signal: AbortSignal,
): Promise<void> {
  for (const asset of ImageAssets.unique(document.strokes)) {
    if (signal.aborted)
      throw Messages.error(Messages.create("imageValidationCancelled"));

    const bytes = ImageAssets.decodeBase64(asset.base64);

    const bitmap = await createImageBitmap(
      new Blob([bytes as BlobPart], { type: asset.mime }),
    );

    try {
      if (signal.aborted)
        throw Messages.error(Messages.create("imageValidationCancelled"));

      ImageAssets.dimensions(bitmap.width, bitmap.height);

      if (!(bitmap.width === asset.width && bitmap.height === asset.height))
        throw Messages.error(
          Messages.create("imageDimensionsDoNotMatchItsHeader"),
        );
    } finally {
      bitmap.close();
    }
  }
}

export const ImagePreflight = { validate };
