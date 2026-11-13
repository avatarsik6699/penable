import type { ClipMask, ImageAsset, ImageItem, Stroke } from "~/entities/board";

export namespace FragmentReaderTypes {
  export type Response =
    | { type: "error"; message: string }
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
          | Omit<Stroke, "points">
          | (Omit<ImageItem, "asset"> & { assetId: string });
      }
    | { type: "points"; values: Float64Array }
    | { type: "done"; region: ClipMask };
}
