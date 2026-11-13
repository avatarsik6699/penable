export type CanvasLayer = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};

export type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
};

export type ImageResolver = (
  asset: import("~/entities/board").ImageAsset,
) => CanvasImageSource | null;
