import type { PointerInput, Position, Viewport } from "../board.types";

export type TouchOptions = {
  viewport: () => Viewport;
  navigate: (viewport: Viewport) => void;
  editing: () => boolean;
  blocked: () => boolean;
  occupied: (editingPointerId: number | null) => boolean;
  origin?: () => Position;
  beginEdit: (event: PointerInput) => boolean;
  moveEdit: (event: PointerInput) => void;
  endEdit: (event: PointerInput) => void;
  cancelEdit: () => void;
  placement: () => boolean;
  place: (event: PointerInput) => void;
  prepareTap?: (event: PointerInput) => (() => void) | null;
};

export type TouchBaseline = {
  center: Position;
  distance: number;
  viewport: Viewport;
};
