import {
  type Viewport,
  type Position,
  type BoardItem,
  type WritingView,
} from "../board.types";
import { BoardRegions } from "../regions";
import { ViewportConfig } from "./viewport.config";

function initialViewport(): Viewport {
  return { zoom: 1, x: 0, y: 0 };
}

function worldToScreen(point: Position, viewport: Viewport): Position {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}

function screenToWorld(point: Position, viewport: Viewport): Position {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  };
}

function zoomAt(
  viewport: Viewport,
  requestedZoom: number,
  anchor: Position,
): Viewport {
  if (
    !Number.isFinite(requestedZoom) ||
    !Number.isFinite(anchor.x) ||
    !Number.isFinite(anchor.y)
  )
    return viewport;

  const zoom = Math.min(
    ViewportConfig.MAX_ZOOM,
    Math.max(ViewportConfig.MIN_ZOOM, requestedZoom),
  );

  if (zoom === viewport.zoom) return viewport;

  const world = screenToWorld(anchor, viewport);

  return { zoom, x: anchor.x - world.x * zoom, y: anchor.y - world.y * zoom };
}

function isValid(viewport: Viewport): boolean {
  return (
    Number.isFinite(viewport.zoom) &&
    viewport.zoom >= 0.25 &&
    viewport.zoom <= 8 &&
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Math.abs(viewport.x) <= 1e9 &&
    Math.abs(viewport.y) <= 1e9
  );
}

function writingView(
  viewport: Viewport,
  width: number,
  height: number,
): WritingView {
  return {
    center: screenToWorld({ x: width / 2, y: height / 2 }, viewport),
    zoom: viewport.zoom,
  };
}

function restoreWritingView(
  view: WritingView,
  width: number,
  height: number,
): Viewport {
  return {
    zoom: view.zoom,
    x: width / 2 - view.center.x * view.zoom,
    y: height / 2 - view.center.y * view.zoom,
  };
}

function fitAll(
  strokes: readonly BoardItem[],
  width: number,
  height: number,
): Viewport {
  const bounds = BoardRegions.visibleBounds(strokes);

  if (!bounds) return initialViewport();

  const zoom = Math.min(
    ViewportConfig.MAX_ZOOM,
    Math.max(
      ViewportConfig.MIN_ZOOM,
      Math.min(
        Math.max(1, width - 96) / Math.max(0.01, bounds.right - bounds.left),
        Math.max(1, height - 96) / Math.max(0.01, bounds.bottom - bounds.top),
      ),
    ),
  );

  return {
    zoom,
    x: width / 2 - ((bounds.left + bounds.right) / 2) * zoom,
    y: height / 2 - ((bounds.top + bounds.bottom) / 2) * zoom,
  };
}

export const ViewportTransforms = {
  zoomAt,
  isValid,
  writingView,
  restoreWritingView,
  initialViewport,
  worldToScreen,
  screenToWorld,
  fitAll,
};
