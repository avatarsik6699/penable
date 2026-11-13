export { WorkspaceModel } from "./model/workspace-model";
export type { WorkspaceDependencies } from "./model/workspace-model";
export { BoardCursor } from "./components/writing-surface";
export type {
  CursorMode,
  CursorBounds,
  CursorPresentation,
} from "./components/writing-surface";
export { EditorRuntime } from "./components/writing-surface";
export type { EditorHandle } from "./components/writing-surface";
export { BoardPaint } from "./components/writing-surface";
export type { StrokePaintState } from "./components/writing-surface";
export { BoardPaths } from "./components/writing-surface";
export { BoardPNG } from "./components/writing-surface";
export { CanvasRenderer } from "./components/writing-surface";
export type { CanvasLayer, FrameScheduler } from "./components/writing-surface";
export { WorkspacePlatform } from "./adapters/workspace-platform";
export { BoardWorkspace } from "./board-workspace";
export { PenToolbar } from "./components/pen-toolbar";
export { PointerDiagnostics } from "./components/pointer-diagnostics";
export { SelectionToolbar } from "./components/selection-toolbar";
export { WritingSurface } from "./components/writing-surface";
export type {
  SelectionState,
  SelectionCommand,
  InputDiagnostics,
  SurfaceControls,
} from "./model/workspace-model.types";

export type { SurfaceElements } from "./components/writing-surface";
