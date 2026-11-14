import { BoardCoordinates } from "~/entities/board";
import { LayerPainter } from "./layer-painter";
import type {
  CanvasLayer,
  FrameScheduler,
  ImageResolver,
} from "./renderer.types";
import { BoardRegions } from "~/entities/board";
import type { SelectionPreview } from "~/entities/board";
import type { Scene, BoardItem, Viewport } from "~/entities/board";

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
  private commits: BoardItem[] = [];
  private disposed = false;
  private preview: ReadonlySet<BoardItem> = new Set();
  private templatePreview: BoardItem | null = null;
  private selectionPreview: SelectionPreview | null = null;
  private canonicalGroups: BoardItem[] | null = null;
  private stationarySource: readonly BoardItem[] | null = null;
  private stationaryGroups: BoardItem[] = [];
  private selectedSource: readonly BoardItem[] | null = null;
  private selectedGroups: BoardItem[] = [];
  private readonly painter: LayerPainter;

  constructor(
    private readonly completed: CanvasLayer,
    private readonly live: CanvasLayer,
    private readonly scene: Scene,
    viewport: Viewport,
    private readonly frames: FrameScheduler = browserFrames,
    imageSource?: ImageResolver,
  ) {
    this.viewport = viewport;
    this.painter = new LayerPainter(imageSource);
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

  setTemplatePreview(item: BoardItem | null) {
    this.templatePreview = item;
    this.activeChanged();
  }

  activeChanged() {
    this.liveDirty = true;
    this.schedule();
  }

  commit(stroke: BoardItem) {
    // Every finished stroke survives even if several contacts happen before the next RAF.
    this.canonicalGroups = null;
    this.commits.push(stroke);
    this.liveDirty = true;
    this.schedule();
  }

  setEraserPreview(preview: ReadonlySet<BoardItem>) {
    this.preview = preview;
    this.sceneChanged();
  }

  setSelectionPreview(preview: SelectionPreview | null) {
    const previous = this.selectionPreview;

    if (!previous && !preview) return;

    const previousMoved =
      previous &&
      (previous.transformed ||
        previous.delta.x !== 0 ||
        previous.delta.y !== 0);

    const moved =
      preview &&
      (preview.transformed || preview.delta.x !== 0 || preview.delta.y !== 0);

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

    if (moved && preview?.ordered) this.fullDirty = true;

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

  private paintOrderedPreview(preview: SelectionPreview) {
    let run: BoardItem[] = [],
      selected = false;

    const paint = () => {
      for (const item of BoardRegions.groupedStrokes(run))
        this.painter.drawStroke(
          this.completed.context,
          item,
          false,
          selected ? preview.delta : undefined,
        );
    };

    for (const entry of preview.ordered ?? []) {
      if (this.preview.has(entry.item)) continue;

      if (run.length && selected !== entry.selected) {
        paint();
        run = [];
      }

      selected = entry.selected;
      run.push(entry.item);
    }

    if (run.length) paint();
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
      selection &&
      (selection.transformed ||
        selection.delta.x !== 0 ||
        selection.delta.y !== 0);

    const ordered = moving && selection.ordered;

    if (this.fullDirty) {
      this.painter.clear(this.completed);

      let completed: readonly BoardItem[];

      if (ordered) completed = [];
      else if (moving) {
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

      if (ordered) this.paintOrderedPreview(selection);
    } else {
      for (const stroke of this.commits) {
        if (!this.preview.has(stroke))
          this.painter.drawStroke(this.completed.context, stroke);
      }
    }

    if (this.fullDirty || this.liveDirty) {
      this.painter.clear(this.live);

      if (moving && !ordered) {
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

      if (this.templatePreview)
        this.painter.drawStroke(this.live.context, this.templatePreview);

      if (this.scene.active)
        this.painter.drawStroke(this.live.context, this.scene.active, true);
    }

    this.commits = [];
    this.fullDirty = false;
    this.liveDirty = false;
  }
}

export type { CanvasLayer, FrameScheduler } from "./renderer.types";
