import { type Scene, type Viewport, type Stroke } from "../board.types";
import { type SurfaceBounds } from "../viewport";

type EraserOptions = {
  scene: Scene;
  bounds: () => SurfaceBounds;
  viewport: () => Viewport;
  onPreviewChange: () => void;
  onCommit: (strokes: ReadonlySet<Stroke>) => void;
};

export type { EraserOptions };
