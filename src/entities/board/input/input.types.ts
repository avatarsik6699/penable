import { type Scene, type Viewport, type Stroke } from "../board.types";
import { type SurfaceBounds } from "../viewport";

type InputOptions = {
  scene: Scene;
  bounds: () => SurfaceBounds;
  viewport: () => Viewport;
  width: () => number;
  writing?: () => import("../board.types").WritingSettings;
  stabilization?: () => number;
  allocateId?: () => number;
  onActiveChange: () => void;
  onCommit: (stroke: Stroke) => void;
};

export type { InputOptions };
