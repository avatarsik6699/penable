const INK = "#182230" as const;

export type Position = {
  x: number;
  y: number;
};

export type Viewport = Position & {
  zoom: number;
};

export type Point = Position & {
  pressure: number;
  time: number;
};

export type DrawingTool = "pen" | "eraser" | "selection";

export type StabilizationMode = "off" | "light" | "strong";

export type StabilizationProfile = {
  readonly captureZoom: number;
} & (
  | {
      readonly strength: number;
      readonly mode?: never;
    }
  | {
      readonly mode: StabilizationMode;
      readonly strength?: never;
    }
);

export type ClipMask = import("polygon-clipping").MultiPolygon;

export type SelectionShape = "rectangle" | "lasso";

export type ActiveStroke = Stroke & {
  pointerId: number;
};

export type Scene = {
  strokes: Stroke[];
  active: ActiveStroke | null;
};

export type PointerSample = {
  pointerId: number;
  clientX: number;
  clientY: number;
  pressure: number;
  timeStamp: number;
};

export type PointerInput = PointerSample & {
  pointerType: string;
  isPrimary: boolean;
  button: number;
  buttons: number;
  getCoalescedEvents?: () => PointerSample[];
};

export type HistoryState = {
  canUndo: boolean;
  canRedo: boolean;
  busy: boolean;
};

export type RegionInput = {
  shape: SelectionShape | "all";
  points: Position[];
};

export type BoardSnapshot = {
  strokes: Stroke[];
  viewport: Viewport;
  background: BackgroundMode;
  tools: {
    width: number;
    stabilization: number;
  };
};

export const BoardConstants = { INK };

export type Stroke = {
  id: number;
  color: typeof INK;
  width: number;
  points: Point[];
  stabilization?: StabilizationProfile;
  source?: string;
  clip?: ClipMask;
  translation?: Position;
};

export type BackgroundMode = "blank" | "dots" | "grid";
