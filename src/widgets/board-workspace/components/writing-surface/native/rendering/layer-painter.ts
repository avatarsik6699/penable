import {
  BoardCoordinates,
  BoardRegions,
  type Viewport,
  type Stroke,
} from "~/entities/board";
import { BoardPaint, type StrokePaintState } from "./paint";
import type { CanvasLayer } from "./renderer.types";

type PaintState = StrokePaintState & {
  sx?: number;
  sy?: number;
  tx?: number;
  ty?: number;
};

const ZERO = { x: 0, y: 0 };

export class LayerPainter {
  private width = -1;
  private height = -1;
  private viewport: Viewport = { zoom: 1, x: 0, y: 0 };
  private raster = BoardCoordinates.bitmapSize(1, 1, 1);
  private paintStates = new WeakMap<CanvasRenderingContext2D, PaintState>();

  configure(
    width: number,
    height: number,
    viewport: Viewport,
    raster: ReturnType<typeof BoardCoordinates.bitmapSize>,
  ) {
    this.width = width;
    this.height = height;
    this.viewport = viewport;
    this.raster = raster;
  }

  clear(layer: CanvasLayer) {
    layer.context.setTransform(1, 0, 0, 1, 0, 0);
    layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    this.paintStates.set(layer.context, {});
  }

  drawStroke(
    ctx: CanvasRenderingContext2D,
    stroke: Stroke,
    active = false,
    delta = ZERO,
  ) {
    const { scaleX, scaleY } = this.raster;
    const { zoom, x, y } = this.viewport;

    if (!active) {
      const source = BoardRegions.sourceBounds(stroke),
        clip = stroke.clip ? BoardRegions.maskBounds(stroke.clip) : null;

      const bounds =
        source && clip
          ? {
              left: Math.max(source.left, clip.left),
              right: Math.min(source.right, clip.right),
              top: Math.max(source.top, clip.top),
              bottom: Math.min(source.bottom, clip.bottom),
            }
          : source;

      const offset = stroke.translation ?? ZERO;

      if (
        !bounds ||
        (bounds.right + offset.x + delta.x) * zoom + x < -1 ||
        (bounds.left + offset.x + delta.x) * zoom + x > this.width + 1 ||
        (bounds.bottom + offset.y + delta.y) * zoom + y < -1 ||
        (bounds.top + offset.y + delta.y) * zoom + y > this.height + 1
      )
        return;
    }

    const sx = scaleX * zoom,
      sy = scaleY * zoom,
      offset = stroke.translation ?? ZERO;

    // Match setTransform(base) followed by translate(offset), including floating
    // point operation order, while avoiding per-stroke save/translate/restore.
    const tx = scaleX * (x + delta.x * zoom) + sx * offset.x;
    const ty = scaleY * (y + delta.y * zoom) + sy * offset.y;
    let state = this.paintStates.get(ctx);

    if (!state) {
      state = {};
      this.paintStates.set(ctx, state);
    }

    if (
      state.sx !== sx ||
      state.sy !== sy ||
      state.tx !== tx ||
      state.ty !== ty
    ) {
      ctx.setTransform(sx, 0, 0, sy, tx, ty);
      state.sx = sx;
      state.sy = sy;
      state.tx = tx;
      state.ty = ty;
    }

    BoardPaint.paintStroke(ctx, stroke, active, state, true);
  }
}
