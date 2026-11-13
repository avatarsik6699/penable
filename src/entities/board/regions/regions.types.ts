import { type Position, type BoardItem } from "../board.types";

type InkBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type InkSegment = {
  a: Position;
  b: Position;
  error: number;
};

type MaskEdge = {
  a: Position;
  b: Position;
};

type SelectedPart = {
  original: BoardItem;
  selected: BoardItem;
  remainder: BoardItem | null;
};

export type { InkBounds, InkSegment, MaskEdge, SelectedPart };
