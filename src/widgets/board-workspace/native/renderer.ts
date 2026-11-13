import { BoardCoordinates } from "~/entities/board";
import { type StrokePaintState, BoardPaint } from "./paint";
import { BoardRegions } from "~/entities/board";
import type { SelectionPreview } from "~/entities/board";
import type { Scene, Stroke, Viewport } from "~/entities/board";
export type CanvasLayer = {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
};
export type FrameScheduler = {
  request: (callback: () => void) => number;
  cancel: (handle: number) => void;
};
const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};
type PaintState = StrokePaintState & {
  sx?: number;
  sy?: number;
  tx?: number;
  ty?: number;
};
const ZERO = { x: 0, y: 0 };
export class CanvasRenderer {
  private width = -1;
  private height = -1;
  private dpr = -1;
  private nativeScale = -1;
  private viewport: Viewport;
  private raster = BoardCoordinates.bitmapSize(1, 1, 1);
  private frameId: number | null = null;
  private fullDirty = true;
  private liveDirty = false;
  private resizePending = false;
  private commits: Stroke[] = [];
  private disposed = false;
  private preview: ReadonlySet<Stroke> = new Set();
  private selectionPreview: SelectionPreview | null = null;
  private canonicalGroups: Stroke[] | null = null;
  private stationarySource: readonly Stroke[] | null = null;
  private stationaryGroups: Stroke[] = [];
  private selectedSource: readonly Stroke[] | null = null;
  private selectedGroups: Stroke[] = [];
  private paintStates = new WeakMap<CanvasRenderingContext2D, PaintState>();
  constructor(
    private readonly completed: CanvasLayer,
    private readonly live: CanvasLayer,
    private readonly scene: Scene,
    viewport: Viewport,
    private readonly frames: FrameScheduler = browserFrames,
  ) {
    this.viewport = viewport;
  }
  get resolution() {
    return this.raster;
  }
  needsResize(
    width: number,
    height: number,
    dpr: number,
    nativeScale = 1,
  ): boolean {
    return (
      this.width !== width ||
      this.height !== height ||
      this.dpr !== BoardCoordinates.validDpr(dpr) ||
      this.nativeScale !== BoardCoordinates.validDpr(nativeScale)
    );
  }
  resize(width: number, height: number, dpr: number, nativeScale = 1) {
    if (!this.needsResize(width, height, dpr, nativeScale)) return;
    this.width = width;
    this.height = height;
    this.dpr = BoardCoordinates.validDpr(dpr);
    this.nativeScale = BoardCoordinates.validDpr(nativeScale);
    this.raster = BoardCoordinates.bitmapSize(
      width,
      height,
      this.dpr,
      this.nativeScale,
    );
    this.resizePending = true;
    this.fullDirty = true;
    this.schedule();
  }
  setViewport(viewport: Viewport) {
    if (
      this.viewport.zoom === viewport.zoom &&
      this.viewport.x === viewport.x &&
      this.viewport.y === viewport.y
    )
      return;
    this.viewport = viewport;
    this.fullDirty = true;
    this.schedule();
  }
  activeChanged() {
    this.liveDirty = true;
    this.schedule();
  }
  commit(stroke: Stroke) {
    // Every finished stroke survives even if several contacts happen before the next RAF.
    this.canonicalGroups = null;
    this.commits.push(stroke);
    this.liveDirty = true;
    this.schedule();
  }
  setEraserPreview(preview: ReadonlySet<Stroke>) {
    this.preview = preview;
    this.sceneChanged();
  }
  setSelectionPreview(preview: SelectionPreview | null) {
    const previous = this.selectionPreview;
    if (!previous && !preview) return;
    const previousMoved =
      previous && (previous.delta.x !== 0 || previous.delta.y !== 0);
    const moved = preview && (preview.delta.x !== 0 || preview.delta.y !== 0);
    this.selectionPreview = preview;
    if (!preview) {
      this.stationarySource = null;
      this.stationaryGroups = [];
      this.selectedSource = null;
      this.selectedGroups = [];
    }
    if (
      Boolean(previousMoved) !== Boolean(moved) ||
      previous?.stationary !== preview?.stationary
    )
      this.fullDirty = true;
    this.liveDirty = true;
    if (this.fullDirty) this.commits = [];
    this.schedule();
  }
  sceneChanged() {
    this.canonicalGroups = null;
    this.stationarySource = null;
    this.commits = [];
    this.fullDirty = true;
    this.liveDirty = true;
    this.schedule();
  }
  dispose() {
    this.disposed = true;
    if (this.frameId !== null) this.frames.cancel(this.frameId);
    this.frameId = null;
    this.commits = [];
  }
  private schedule() {
    if (this.disposed || this.frameId !== null) return;
    this.frameId = this.frames.request(() => this.flush());
  }
  private flush() {
    this.frameId = null;
    if (this.disposed) return;
    if (this.resizePending) {
      const layers = [this.completed, this.live];
      // Release shrinking dimensions on both layers before allocating any larger dimension.
      for (const { canvas } of layers) {
        if (canvas.width > this.raster.width) canvas.width = this.raster.width;
        if (canvas.height > this.raster.height)
          canvas.height = this.raster.height;
      }
      for (const { canvas } of layers) {
        if (canvas.width < this.raster.width) canvas.width = this.raster.width;
        if (canvas.height < this.raster.height)
          canvas.height = this.raster.height;
      }
      this.resizePending = false;
    }
    const selection = this.selectionPreview;
    const moving =
      selection && (selection.delta.x !== 0 || selection.delta.y !== 0);
    if (this.fullDirty) {
      this.clear(this.completed);
      let completed: readonly Stroke[];
      if (moving) {
        if (this.stationarySource !== selection.stationary) {
          this.stationarySource = selection.stationary;
          this.stationaryGroups = BoardRegions.groupedStrokes(
            selection.stationary.filter((stroke) => !this.preview.has(stroke)),
          );
        }
        completed = this.stationaryGroups;
      } else {
        this.canonicalGroups ??= BoardRegions.groupedStrokes(
          this.scene.strokes.filter((stroke) => !this.preview.has(stroke)),
        );
        completed = this.canonicalGroups;
      }
      for (const stroke of completed) {
        this.drawStroke(this.completed.context, stroke);
      }
    } else {
      for (const stroke of this.commits) {
        if (!this.preview.has(stroke))
          this.drawStroke(this.completed.context, stroke);
      }
    }
    if (this.fullDirty || this.liveDirty) {
      this.clear(this.live);
      if (moving) {
        if (this.selectedSource !== selection.selected) {
          this.selectedSource = selection.selected;
          this.selectedGroups = BoardRegions.groupedStrokes(selection.selected);
        }
        for (const stroke of this.selectedGroups)
          this.drawStroke(this.live.context, stroke, false, selection.delta);
      }
      if (this.scene.active)
        this.drawStroke(this.live.context, this.scene.active, true);
    }
    this.commits = [];
    this.fullDirty = false;
    this.liveDirty = false;
  }
  private clear(layer: CanvasLayer) {
    layer.context.setTransform(1, 0, 0, 1, 0, 0);
    layer.context.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    this.paintStates.set(layer.context, {});
  }
  private drawStroke(
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
