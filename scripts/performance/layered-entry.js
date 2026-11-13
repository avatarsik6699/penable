// Consume actual supported module APIs; no copied drawing implementation.
import { BoardSourceGeometry, BoardGeometry, BoardStabilization } from "@board";
import { BoardPaint } from "@workspace";
export { PenInput, EraserInput, StrokeHistory } from "@board";
export { CanvasRenderer } from "@workspace";
export const sourceGeometry = BoardSourceGeometry.sourceGeometry;
export const strokeGeometry = BoardGeometry.strokeGeometry;
export const stabilizedPositions = BoardStabilization.stabilizedPositions;
export const paintStroke = BoardPaint.paintStroke;
