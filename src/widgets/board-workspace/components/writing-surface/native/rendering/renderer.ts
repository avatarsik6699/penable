import { BoardCoordinates } from "~/entities/board";
import { LayerPainter } from "./layer-painter";
import type { CanvasLayer, FrameScheduler } from "./renderer.types";
import { BoardRegions } from "~/entities/board";
import type { SelectionPreview } from "~/entities/board";
import type { Scene, Stroke, Viewport } from "~/entities/board";

const browserFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (handle) => cancelAnimationFrame(handle),
};

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
  private readonly painter = new LayerPainter();

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

    this.painter.configure(this.width, this.height, this.viewport, this.raster);

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
      this.painter.clear(this.completed);

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
        this.painter.drawStroke(this.completed.context, stroke);
      }
    } else {
      for (const stroke of this.commits) {
        if (!this.preview.has(stroke))
          this.painter.drawStroke(this.completed.context, stroke);
      }
    }

    if (this.fullDirty || this.liveDirty) {
      this.painter.clear(this.live);

      if (moving) {
        if (this.selectedSource !== selection.selected) {
          this.selectedSource = selection.selected;
          this.selectedGroups = BoardRegions.groupedStrokes(selection.selected);
        }

        for (const stroke of this.selectedGroups)
          this.painter.drawStroke(
            this.live.context,
            stroke,
            false,
            selection.delta,
          );
      }

      if (this.scene.active)
        this.painter.drawStroke(this.live.context, this.scene.active, true);
    }

    this.commits = [];
    this.fullDirty = false;
    this.liveDirty = false;
  }
}

export type { CanvasLayer, FrameScheduler } from "./renderer.types";
