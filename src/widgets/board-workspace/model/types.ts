import type { Stroke, Viewport, SelectionShape } from "~/entities/board";
export type SelectionState = {
  selected: boolean;
  clipboard: boolean;
  busy: boolean;
  message: string;
  png: boolean;
};
export type SelectionCommand =
  | "all"
  | "clear"
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "duplicate"
  | "image"
  | "download";

export type InputDiagnostics = {
  pointerType: string | null;
  pressure: number | null;
  active: boolean;
  dpr: number;
  coalesced: boolean;
  zoom: number;
  nativeScale: number;
  requestedRatio: number;
  effectiveRatio: number;
  bitmapWidth: number;
  bitmapHeight: number;
  resolutionCapped: boolean;
};
export type SurfaceControls = {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  fitAll: () => void;
  selection: (command: SelectionCommand) => void;
  selectionShape: (shape: SelectionShape) => void;
  undo: () => void;
  redo: () => void;
  snapshot: () => {
    strokes: Stroke[];
    viewport: Viewport;
  };
  isBusy: () => boolean;
  cancelInput: () => void;
};
