import {
  type Stroke,
  type Position,
  type ClipMask,
  type Scene,
  type Viewport,
  type RegionInput,
} from "../board.types";
import { type SelectedPart } from "../regions";

type SelectionPreview = {
  stationary: readonly Stroke[];
  selected: readonly Stroke[];
  delta: Position;
};

type SelectionClipboard = {
  strokes: Stroke[];
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
  validate: (strokes: Stroke[], signal: AbortSignal) => void | Promise<void>;
  commit: (strokes: Stroke[]) => void;
  preview: (preview: SelectionPreview | null) => void;
  changed: () => void;
  setViewport: (viewport: Viewport) => void;
};

export type { SelectionPreview, SelectionClipboard, SelectionOptions };
