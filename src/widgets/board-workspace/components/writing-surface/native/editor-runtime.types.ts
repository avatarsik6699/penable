import type { MinimapElements } from "./minimap";

export type SurfaceElements = MinimapElements & {
  canvas: HTMLCanvasElement | null;
  completed: HTMLCanvasElement | null;
  background: HTMLDivElement | null;
  selectionPath: SVGPathElement | null;
  cursor: HTMLDivElement | null;
  focusBadge: HTMLSpanElement | null;
};

export type EditorHandle = {
  refresh: () => void;
  cancel: () => void;
  dispose: () => void;
};
