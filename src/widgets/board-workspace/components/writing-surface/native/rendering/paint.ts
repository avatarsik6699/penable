import { Theme, type ThemeTypes } from "~/shared/lib/theme";
import { TemplatePaint } from "./template-paint";
import { PressurePaint } from "./pressure-paint";
import type { RenderingContext } from "./rendering-context.types";
import { BoardPaths } from "./path-cache";
import type { StrokeGeometry } from "~/entities/board";
import { BoardSourceGeometry } from "~/entities/board";
import { BoardRegions } from "~/entities/board";
import {
  BoardTransforms,
  type Stroke,
  type ImageAsset,
} from "~/entities/board";
import type { BoardItem } from "~/entities/board";

const paths = new WeakMap<StrokeGeometry, Path2D>();

export type StrokePaintState = {
  color?: string;
  width?: number;
  configured?: boolean;
  opacity?: number;
};

function style(
  ctx: RenderingContext,
  stroke: Stroke,
  state?: StrokePaintState,
  theme: ThemeTypes.Effective = "light",
) {
  const color = Theme.color(stroke.color, theme);

  if (!state || state.color !== color) {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;

    if (state) state.color = color;
  }

  if (!state || state.width !== stroke.width) {
    ctx.lineWidth = stroke.width;

    if (state) state.width = stroke.width;
  }

  const opacity = stroke.style?.opacity ?? 1;

  if (!state || state.opacity !== opacity) {
    ctx.globalAlpha = opacity;

    if (state) state.opacity = opacity;
  }

  if (!state?.configured) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (state) state.configured = true;
  }
}

function paintStroke(
  ctx: RenderingContext,
  stroke: BoardItem,
  active = false,
  state?: StrokePaintState,
  translationHandled = false,
  imageSource?: (asset: ImageAsset) => CanvasImageSource | null,
  theme: ThemeTypes.Effective = "light",
): void {
  if (stroke.kind === "image") {
    const image = imageSource?.(stroke.asset);

    if (!image) return;

    ctx.save();

    try {
      ctx.globalAlpha = 1;

      if (!translationHandled) ctx.transform(...stroke.matrix);

      if (stroke.clip) {
        BoardPaths.traceMask(ctx, stroke.clip);
        ctx.clip("nonzero");
      }

      ctx.drawImage(image, 0, 0, stroke.asset.width, stroke.asset.height);
    } finally {
      ctx.restore();
    }

    return;
  }

  if (stroke.kind === "template") {
    ctx.save();

    try {
      if (!translationHandled) ctx.transform(...stroke.matrix);

      if (stroke.clip) {
        BoardPaths.traceMask(ctx, stroke.clip);
        ctx.clip("nonzero");
      }

      TemplatePaint.paint(ctx, stroke, theme);
    } finally {
      ctx.restore();
    }

    return;
  }

  // Renderer styles sit outside save/restore so the next stroke can reuse them.
  // Standalone callers retain the original Canvas state behavior.
  if (state) style(ctx, stroke, state, theme);

  const transformed = Boolean(
    stroke.clip ||
    ((stroke.translation || stroke.matrix) && !translationHandled),
  );

  if (transformed) ctx.save();

  try {
    if (stroke.matrix && !translationHandled)
      ctx.transform(...BoardTransforms.matrix(stroke));
    else if (stroke.translation && !translationHandled)
      ctx.translate(stroke.translation.x, stroke.translation.y);

    if (stroke.clip) {
      BoardPaths.traceMask(ctx, stroke.clip);
      ctx.clip("nonzero");
    }

    if (!state) style(ctx, stroke, undefined, theme);

    if (stroke.style?.instrument === "pressure") {
      PressurePaint.paint(ctx, stroke, active);

      return;
    }

    const geometry = BoardSourceGeometry.sourceGeometry(stroke, active);

    if (geometry.kind === "empty") return;

    ctx.beginPath();

    if (geometry.kind === "dot") {
      ctx.arc(geometry.x, geometry.y, geometry.radius, 0, Math.PI * 2);
      ctx.fill();

      return;
    }

    if (typeof Path2D !== "undefined") {
      let path = active
        ? BoardPaths.livePath(BoardSourceGeometry.liveGeometry(stroke))
        : paths.get(geometry);

      if (!path) {
        path = new Path2D();
        BoardPaths.traceGeometry(path, geometry);

        if (!active) paths.set(geometry, path);
      }

      ctx.stroke(path);
    } else {
      BoardPaths.traceGeometry(ctx, geometry);
      ctx.stroke();
    }
  } finally {
    if (transformed) ctx.restore();
  }
}

function paintStrokes(
  ctx: RenderingContext,
  strokes: readonly BoardItem[],
  imageSource?: (asset: ImageAsset) => CanvasImageSource | null,
  theme: ThemeTypes.Effective = "light",
): void {
  for (const stroke of BoardRegions.groupedStrokes(strokes))
    paintStroke(ctx, stroke, false, undefined, false, imageSource, theme);
}

export const BoardPaint = { paintStroke, paintStrokes };
