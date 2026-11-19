import {
  BoardText,
  BoardViewport,
  type TextItem,
  type Viewport,
} from "~/entities/board";

function width(canvasWidth: number) {
  return Math.max(
    BoardText.minWidth,
    Math.min(BoardText.maxWidth, canvasWidth - 32),
  );
}

function matrix(
  layout: Pick<TextItem, "width" | "lines">,
  viewport: Viewport,
  bounds: { width: number; height: number },
  dockBottom: number,
): TextItem["matrix"] {
  const top = Math.max(16, Math.min(bounds.height - 32, dockBottom + 16));
  const bottom = Math.max(top + 1, bounds.height - 84);
  const height = layout.lines.length * BoardText.lineHeight;

  const origin = BoardViewport.screenToWorld(
    {
      x: (bounds.width - layout.width) / 2,
      y: Math.max(top, (top + bottom - height) / 2),
    },
    viewport,
  );

  const scale = 1 / viewport.zoom;

  return [scale, 0, 0, scale, origin.x, origin.y];
}

export const TextPlacement = { width, matrix };
