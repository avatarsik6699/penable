import { type Viewport, type Position } from "../board.types";

type NavigationOptions = {
  viewport: Viewport;
  isDrawing: () => boolean;
  onChange: (viewport: Viewport) => void;
  clock: () => number;
};

type BoardWheel = {
  deltaX: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  anchor: Position;
  width: number;
  height: number;
};

type PanContact = {
  pointerId: number;
  buttonMask: number;
  origin: Position;
  viewport: Viewport;
};

export type { NavigationOptions, BoardWheel, PanContact };
