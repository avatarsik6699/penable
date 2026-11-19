import type { MessageTypes } from "~/shared/lib/messages";
import type {
  ClipMask,
  ImageAsset,
  ImageItem,
  Stroke,
  TemplateItem,
  TextItem,
} from "~/entities/board";

export namespace FragmentReaderTypes {
  export type Response =
    | {
        type: "error";
        message: MessageTypes.Value;
      }
    | {
        type: "asset";
        asset: Omit<ImageAsset, "base64">;
        value: string;
        offset: number;
        length: number;
      }
    | {
        type: "item";
        item:
          | TemplateItem
          | TextItem
          | Omit<Stroke, "points">
          | (Omit<ImageItem, "asset"> & {
              assetId: string;
            });
      }
    | {
        type: "points";
        values: Float64Array;
      }
    | {
        type: "done";
        region: ClipMask;
      };
}
