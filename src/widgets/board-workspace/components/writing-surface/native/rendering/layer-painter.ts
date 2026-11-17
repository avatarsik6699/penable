import type { ThemeTypes } from "~/shared/lib/theme";
import {
  BoardCoordinates,
  BoardTransforms,
  type ImageAsset,
  BoardRegions,
  type Viewport,
  type BoardItem,
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
  private theme: ThemeTypes.Effective = "light";
  private width = -1;
  private height = -1;
  private viewport: Viewport = { zoom: 1, x: 0, y: 0 };
  private raster = BoardCoordinates.bitmapSize(1, 1, 1);
  private paintStates = new WeakMap<CanvasRenderingContext2D, PaintState>();

  constructor(
    private readonly imageSource?: (
      asset: ImageAsset,
    ) => CanvasImageSource | null,
  ) {}

  setTheme(theme: ThemeTypes.Effective) {
    if (theme === this.theme) return;

    this.theme = theme;
    this.paintStates = new WeakMap();
  }

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
    stroke: BoardItem,
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

      if (stroke.matrix && bounds) {
        const world = BoardTransforms.bounds(bounds, stroke.matrix);

        if (
          (world.right + delta.x) * zoom + x < -1 ||
          (world.left + delta.x) * zoom + x > this.width + 1 ||
          (world.bottom + delta.y) * zoom + y < -1 ||
          (world.top + delta.y) * zoom + y > this.height + 1
        )
          return;
      }

      if (
        !bounds ||
        (!stroke.matrix &&
          ((bounds.right + offset.x + delta.x) * zoom + x < -1 ||
            (bounds.left + offset.x + delta.x) * zoom + x > this.width + 1 ||
            (bounds.bottom + offset.y + delta.y) * zoom + y < -1 ||
            (bounds.top + offset.y + delta.y) * zoom + y > this.height + 1))
      )
        return;
    }

    if (stroke.matrix) {
      const m = stroke.matrix;

      ctx.setTransform(
        scaleX * zoom * m[0],
        scaleY * zoom * m[1],
        scaleX * zoom * m[2],
        scaleY * zoom * m[3],
        scaleX * (x + delta.x * zoom) + scaleX * zoom * m[4],
        scaleY * (y + delta.y * zoom) + scaleY * zoom * m[5],
      );

      const state = this.paintStates.get(ctx) ?? {};

      delete state.sx;
      delete state.sy;
      delete state.tx;
      delete state.ty;
      this.paintStates.set(ctx, state);

      BoardPaint.paintStroke(
        ctx,
        stroke,
        active,
        state,
        true,
        this.imageSource,
        this.theme,
      );

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

    BoardPaint.paintStroke(
      ctx,
      stroke,
      active,
      state,
      true,
      this.imageSource,
      this.theme,
    );
  }
}
