import {
  type BoardItem,
  type Position,
  type ClipMask,
  type Scene,
  type Viewport,
  type RegionInput,
} from "../board.types";
import { type SelectedPart } from "../regions";

type SelectionPreview = {
  stationary: readonly BoardItem[];
  selected: readonly BoardItem[];
  delta: Position;
  transformed?: boolean;
  ordered?: readonly { item: BoardItem; selected: boolean }[];
};

type SelectionClipboard = {
  strokes: BoardItem[];
  region?: ClipMask;
};

type SelectionOptions = {
  scene: Scene;
  clipboard?: SelectionClipboard;
  viewport: () => Viewport;
  bounds: () => {
    left: number;
    top: number;
    width: number;
    height: number;
  };
  writable: () => boolean;
  select?: (
    input: RegionInput,
    signal: AbortSignal,
  ) =>
    | {
        region: ClipMask;
        parts: SelectedPart[];
      }
    | Promise<{
        region: ClipMask;
        parts: SelectedPart[];
      }>;
  validate: (strokes: BoardItem[], signal: AbortSignal) => void | Promise<void>;
  commit: (strokes: BoardItem[]) => void;
  preview: (preview: SelectionPreview | null) => void;
  changed: () => void;
  setViewport: (viewport: Viewport) => void;
};

export type { SelectionPreview, SelectionClipboard, SelectionOptions };
