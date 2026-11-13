export { WorkspaceModel } from "./model/workspace-model";
export type { WorkspaceDependencies } from "./model/workspace-model";
export { BoardCursor } from "./native/cursor";
export type {
  CursorMode,
  CursorBounds,
  CursorPresentation,
} from "./native/cursor";
export { EditorRuntime } from "./native/editor-runtime";
export type { EditorHandle } from "./native/editor-runtime";
export { BoardPaint } from "./native/paint";
export type { StrokePaintState } from "./native/paint";
export { BoardPaths } from "./native/path-cache";
export { BoardPNG } from "./native/png";
export { CanvasRenderer } from "./native/renderer";
export type { CanvasLayer, FrameScheduler } from "./native/renderer";
export { WorkspacePlatform } from "./native/workspace-platform";
export { BoardWorkspace } from "./ui/board-workspace";
export { PenToolbar } from "./ui/pen-toolbar";
export { PointerDiagnostics } from "./ui/pointer-diagnostics";
export { SelectionToolbar } from "./ui/selection-toolbar";
export { WritingSurface } from "./ui/writing-surface";
export type {
  SelectionState,
  SelectionCommand,
  InputDiagnostics,
  SurfaceControls,
} from "./model/types";

export type { SurfaceElements } from "./native/surface-elements";
