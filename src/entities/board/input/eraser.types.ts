import { type Scene, type Viewport, type Stroke } from "../board.types";
import { type SurfaceBounds } from "../viewport";

type EraserOptions = {
  allowTouch?: () => boolean;
  scene: Scene;
  bounds: () => SurfaceBounds;
  viewport: () => Viewport;
  onPreviewChange: () => void;
  onCommit: (strokes: ReadonlySet<Stroke>) => void;
};

export type { EraserOptions };
