import { type Viewport, type Position, type Stroke } from "../board.types";
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

function fitAll(
  strokes: readonly Stroke[],
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
  initialViewport,
  worldToScreen,
  screenToWorld,
  fitAll,
};
