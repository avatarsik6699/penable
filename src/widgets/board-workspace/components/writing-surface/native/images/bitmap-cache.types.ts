export namespace BitmapCacheTypes {
  export type NativeArrayDecoder = {
    fromBase64?: (
      text: string,
      options: { lastChunkHandling: "strict" },
    ) => Uint8Array;
  };

  export type Entry = {
    promise: Promise<ImageBitmap>;
    bitmap: ImageBitmap | null;
    claims: number;
  };

  export type Claim = {
    ready: Promise<ImageBitmap>;
    release: (retain: boolean) => void;
  };
}
