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
  strokes: BoardItem[];
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
  shiftKey?: boolean;
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

export type BackgroundSettings = { contrast: number; spacing: number };

export type WritingView = { center: Position; zoom: number };

export type BoardSnapshot = {
  strokes: BoardItem[];
  viewport: Viewport;
  background: BackgroundMode;
  backgroundSettings?: BackgroundSettings;
  lastWritingView?: WritingView | null;
  tools: {
    width: number;
    stabilization: number;
    writing?: WritingSettings;
  };
};

export const BoardConstants = { INK };

export type AffineMatrix = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export type ImageAsset = {
  readonly id: string;
  readonly mime: "image/png" | "image/jpeg";
  readonly width: number;
  readonly height: number;
  readonly base64: string;
};

export type ImageItem = {
  readonly kind: "image";
  id: number;
  readonly asset: ImageAsset;
  source?: string;
  clip?: ClipMask;
  matrix: AffineMatrix;
  translation?: Position;
};

export type BoardItem = Stroke | ImageItem | TemplateItem;

export type Stroke = {
  kind?: "ink";
  matrix?: AffineMatrix;
  id: number;
  color: InkColor;
  style?: InkStyle;
  width: number;
  points: Point[];
  stabilization?: StabilizationProfile;
  source?: string;
  clip?: ClipMask;
  translation?: Position;
};

export type BackgroundMode = "blank" | "dots" | "grid";

export type InkColor =
  | "#182230"
  | "#667085"
  | "#175cd3"
  | "#0ba5ec"
  | "#0e9384"
  | "#2e7d32"
  | "#f4c430"
  | "#e87518"
  | "#d92d20"
  | "#7f56d9";

export type InkInstrument = "pen" | "pressure" | "highlighter";

export type InkStyle = Readonly<{
  instrument: InkInstrument;
  opacity: number;
  pressureStrength: number;
}>;

export type InstrumentSettings = Readonly<{
  color: InkColor;
  width: number;
  stabilization: number;
  opacity: number;
  pressureStrength: number;
}>;

export type WritingSettings = Readonly<{
  instrument: InkInstrument;
  instruments: Readonly<Record<InkInstrument, InstrumentSettings>>;
}>;

export type TemplateKind =
  | "line"
  | "arrow"
  | "rectangle"
  | "ellipse"
  | "triangle"
  | "number-line"
  | "axes"
  | "circle";

export type TemplateConfig = Readonly<{
  kind: TemplateKind;
  width: number;
  height: number;
  color: InkColor;
  lineWidth: number;
  dashed: boolean;
  fill: InkColor | null;
  min: number;
  max: number;
  step: number;
  numbers: boolean;
  grid: boolean;
  labels: boolean;
  rays: boolean;
}>;

export type TemplateItem = {
  readonly kind: "template";
  id: number;
  readonly generatorVersion: 1 | 2;
  readonly template: TemplateConfig;
  matrix: AffineMatrix;
  source?: string;
  clip?: ClipMask;
  translation?: Position;
};
