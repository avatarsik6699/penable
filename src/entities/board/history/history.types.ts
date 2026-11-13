import { type BoardItem } from "../board.types";

type IndexedStroke = {
  stroke: BoardItem;
  index: number;
};

type DeltaOperation = {
  kind?: never;
  removed: IndexedStroke[];
  inserted: IndexedStroke[];
};

// Contiguous changes store only their changed middle. Sparse equal-length edits
// additionally carry indices, so moving two distant fragments retains no intervening ink.
type Replacement = {
  kind: "replace";
  start: number;
  before: BoardItem[];
  after: BoardItem[];
  indices?: number[];
};

type Operation = DeltaOperation | Replacement;

export type { IndexedStroke, DeltaOperation, Replacement, Operation };
