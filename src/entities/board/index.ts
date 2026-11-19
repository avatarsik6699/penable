export { BoardBackground } from "./viewport";
export type { BackgroundMode } from "./board.types";
export { BoardCoordinates } from "./viewport";
export type { SurfaceBounds } from "./viewport";
export { EraserInput } from "./input";
export { BoardGeometry } from "./geometry";
export type { PathCommand, StrokeGeometry } from "./geometry";
export { StrokeHistory } from "./history";
export { StrokeHitTester, BoardHitTest } from "./input";
export { PenInput, BoardInput } from "./input";
export { LiveStrokeGeometry } from "./geometry";
export { BoardRegions } from "./regions";
export type { InkBounds, SelectedPart } from "./regions";
export { BoardLimits } from "./scene-limits";
export { BoardSelection, BoardSelectionHelpers } from "./selection";
export type {
  SelectionCommitResult,
  SelectionPreview,
  SelectionClipboard,
} from "./selection";
export { BoardShortcuts } from "./input";
export type { HistoryAction } from "./input";
export { BoardSnapshots } from "./snapshots";
export { BoardSourceGeometry } from "./geometry";
export { IncrementalStabilizer, BoardStabilization } from "./geometry";
export { BoardIds } from "./stroke-ids";
export { BoardConstants } from "./board.types";
export type {
  Position,
  Viewport,
  Point,
  DrawingTool,
  StabilizationMode,
  StabilizationProfile,
  ClipMask,
  SelectionShape,
  Stroke,
  ActiveStroke,
  Scene,
  PointerSample,
  PointerInput,
  HistoryState,
  RegionInput,
  BoardSnapshot,
  BackgroundSettings,
  WritingView,
} from "./board.types";
export { BoardNavigation, BoardViewport } from "./viewport";
export type { BoardWheel } from "./viewport";

export type {
  BoardItem,
  ImageItem,
  ImageAsset,
  TextItem,
  AffineMatrix,
} from "./board.types";
export { BoardTransforms } from "./transforms";
export { BoardText } from "./board-text";

export { BoardWriting } from "./writing";
export { BoardTemplates } from "./templates";
export { BoardTemplateSteps } from "./templates";
export { BoardPressure, LivePressureOutline } from "./writing";
export type { PressureDisc, PressureSegment, PressureOutline } from "./writing";
export type { TemplatePrimitive, TemplateLayout } from "./templates";
export type {
  InkColor,
  InkInstrument,
  InkStyle,
  InstrumentSettings,
  WritingSettings,
  TemplateKind,
  TemplateConfig,
  TemplateItem,
} from "./board.types";

export type { RibbonSection, PressureRibbonGeometry } from "./writing";

export { BoardTouchGestures } from "./touch";
