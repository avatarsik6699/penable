import type { Scene, Viewport } from "~/entities/board";

export type MinimapElements = {
  mapHost: HTMLDivElement | null;
  mapCanvas: HTMLCanvasElement | null;
  mapArea: HTMLButtonElement | null;
  mapFrame: SVGRectElement | null;
  mapMarker: SVGCircleElement | null;
  mapStatus: HTMLParagraphElement | null;
  mapOutside: HTMLParagraphElement | null;
  mapFit: HTMLButtonElement | null;
};

export type MinimapOptions = {
  elements: MinimapElements;
  scene: Scene;
  viewport: () => Viewport;
  bounds: () => { width: number; height: number };
  blocked: () => boolean;
  navigate: (view: Viewport) => boolean;
};
