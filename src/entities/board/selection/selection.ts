import { SelectionGesture } from "./modules/gesture";
import { SelectionCandidates } from "./selection-candidates";
import { SelectionOperation } from "./selection-operation";
import { SelectionClipboardTransforms } from "./selection-clipboard";
import {
  type SelectionShape,
  type ClipMask,
  type Viewport,
  type Stroke,
  type Position,
  type PointerInput,
  type RegionInput,
} from "../board.types";
import { type SelectedPart, BoardRegions } from "../regions";
import { BoardViewport } from "../viewport";
import { BoardLimits } from "../scene-limits";
import {
  type SelectionPreview,
  type SelectionClipboard,
  type SelectionOptions,
} from "./selection.types";
import { SelectionConfig } from "./selection.config";
import { SelectionUtils } from "./selection.utils";

// Membership and geometry previews live here; the canonical scene is changed only after
// the complete replacement has passed the document limits and topology checks.
export class BoardSelection {
  shape: SelectionShape = "rectangle";
  private readonly operation = new SelectionOperation({
    changed: () => this.options.changed(),
    report: (error) => this.report(error),

    pending: () => {
      this.message = "Подготовка выделения… Esc — отмена.";
    },
  });
  private parts: SelectedPart[] = [];
  private readonly gesture = new SelectionGesture({
    world: (event) => this.world(event),
    viewport: () => this.options.viewport(),
    writable: () => this.options.writable(),
    hit: (point) => this.hit(point),
    shape: () => this.shape,
  });
  private rollbackViewport: Viewport | null = null;
  private region: ClipMask = [];
  private previewBase: Omit<SelectionPreview, "delta"> | null = null;
  private readonly localClipboard: SelectionClipboard = { strokes: [] };

  private get clipboard(): SelectionClipboard {
    return this.options.clipboard ?? this.localClipboard;
  }

  private get buffer(): Stroke[] {
    return this.clipboard.strokes;
  }

  private delta: Position = { ...SelectionConfig.ZERO };
  private nudging = false;
  message = "";

  constructor(private readonly options: SelectionOptions) {}

  get pointerId(): number | null {
    return this.gesture.pointerId;
  }

  get busy(): boolean {
    return (
      this.gesture.pointerId !== null || this.nudging || this.operation.busy
    );
  }

  get moving(): boolean {
    return this.gesture.moving;
  }

  get hasClipboard(): boolean {
    return this.buffer.length > 0;
  }

  get selected(): Stroke[] {
    return this.parts.map((part) =>
      SelectionUtils.shifted(part.selected, this.delta),
    );
  }

  get hasSelection(): boolean {
    return this.parts.length > 0;
  }

  get outline(): ClipMask {
    if (this.operation.outline) return this.operation.outline;

    const draft = this.gesture.draftOutline;

    if (draft) return draft;

    return this.delta.x || this.delta.y
      ? BoardRegions.translateMask(this.region, this.delta)
      : this.region;
  }

  hit(point: Position): boolean {
    return this.hasSelection && BoardRegions.contains(this.outline, point);
  }

  private world(event: Pick<PointerInput, "clientX" | "clientY">): Position {
    const bounds = this.options.bounds();

    return BoardViewport.screenToWorld(
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      this.options.viewport(),
    );
  }

  private report(error: unknown) {
    this.message =
      error instanceof Error
        ? error.message
        : "Не удалось обработать выделение.";

    this.options.changed();
  }

  down(event: PointerInput): boolean {
    if (this.busy || !this.gesture.down(event)) return false;

    this.delta = { ...SelectionConfig.ZERO };
    this.previewBase = null;
    this.message = "";
    this.options.changed();

    return true;
  }

  move(event: PointerInput): boolean {
    const update = this.gesture.move(event);

    if (update.kind === "ignored") return false;

    if (update.kind === "handled") return true;

    if (update.kind === "cancel" || update.kind === "error") {
      this.cancel();

      if (update.kind === "error") this.report(update.error);

      return true;
    }

    if (update.kind === "drag") {
      this.delta = update.delta;
      this.previewMove();
    }

    this.options.changed();

    return true;
  }

  up(event: PointerInput): boolean {
    if (this.pointerId !== event.pointerId || event.button !== 0) return false;

    // Capture the final position before releasing the authoritative gesture.
    this.move({
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      isPrimary: event.isPrimary,
      button: event.button,
      buttons: 1,
      clientX: event.clientX,
      clientY: event.clientY,
      pressure: event.pressure,
      timeStamp: event.timeStamp,
    });

    const released = this.gesture.release();

    if (released.kind === "drag") this.finishMove(released.viewport);
    else if (released.kind === "region") this.selectRegion(released.input);

    return true;
  }

  private previewMove() {
    if (!this.previewBase) {
      const byOriginal = new Map(
        this.parts.map((part) => [part.original, part]),
      );

      this.previewBase = {
        stationary: this.options.scene.strokes.flatMap((stroke) => {
          const part = byOriginal.get(stroke);

          return part ? (part.remainder ? [part.remainder] : []) : [stroke];
        }),
        selected: this.parts.map((part) => part.selected),
      };
    }

    this.options.preview({ ...this.previewBase, delta: this.delta });
  }

  private selectRegion(input: RegionInput) {
    const outline =
      input.shape === "all"
        ? null
        : input.shape === "rectangle"
          ? BoardRegions.rectangle(input.points[0]!, input.points.at(-1)!)
          : input.points.length < 3
            ? []
            : ([
                [
                  input.points
                    .concat(input.points[0]!)
                    .map(({ x, y }) => [x, y]),
                ],
              ] as ClipMask);

    this.operation.run(
      (signal) => {
        if (this.options.select) return this.options.select(input, signal);

        return SelectionUtils.prepareSelection(
          this.options.scene.strokes,
          input,
        );
      },
      (result) => {
        this.parts = result.parts;
        this.region = result.region;
        this.message = "";
      },
      () => {},
      outline,
    );
  }

  private apply(
    candidate: {
      strokes: Stroke[];
      selected: Stroke[];
    },
    region = this.region,
    finish: (success: boolean) => void = () => {},
  ) {
    if (candidate.strokes.length > BoardLimits.SCENE_LIMITS.strokes) {
      finish(false);

      const reason =
        this.options.scene.strokes.length >= BoardLimits.SCENE_LIMITS.strokes
          ? "На доске достигнут предел 20 000 фрагментов."
          : "Действие превысит предел 20 000 фрагментов.";

      this.report(
        new Error(
          reason +
            " Перенос части штриха создаёт дополнительные фрагменты. Выделите штрихи целиком или удалите ненужные записи.",
        ),
      );

      return;
    }

    const before = [...this.options.scene.strokes];

    this.operation.run(
      (signal) => this.options.validate(candidate.strokes, signal),
      () => {
        if (
          !this.options.writable() ||
          before.length !== this.options.scene.strokes.length ||
          before.some(
            (stroke, index) => stroke !== this.options.scene.strokes[index],
          )
        )
          throw new Error("Доска изменилась. Повторите действие.");

        this.options.commit(candidate.strokes);

        this.parts = candidate.selected.map((stroke) => ({
          original: stroke,
          selected: stroke,
          remainder: null,
        }));

        this.region = region;
        this.previewBase = null;
        this.message = "";
      },
      finish,
    );
  }

  private finishMove(viewport?: Viewport) {
    const finish = (success: boolean) => {
      if (!success && viewport) this.options.setViewport(viewport);

      this.rollbackViewport = null;
      this.delta = { ...SelectionConfig.ZERO };
      this.previewBase = null;
      this.nudging = false;
      this.options.preview(null);
      this.options.changed();
    };

    if (this.delta.x || this.delta.y) {
      this.rollbackViewport = viewport ?? null;

      this.apply(
        SelectionCandidates.candidate(
          this.options.scene.strokes,
          this.parts,
          this.delta,
        ),
        BoardRegions.translateMask(this.region, this.delta),
        finish,
      );
    } else finish(true);
  }

  cancel(): boolean {
    const active = this.busy;
    const viewport = this.gesture.cancel();

    if (this.operation.busy) this.message = "";

    this.operation.cancel();
    this.nudging = false;
    this.delta = { ...SelectionConfig.ZERO };
    this.previewBase = null;
    this.options.preview(null);

    if (viewport || this.rollbackViewport)
      this.options.setViewport(viewport ?? this.rollbackViewport!);

    this.rollbackViewport = null;
    this.options.changed();

    return active;
  }

  clear() {
    if (this.busy) {
      this.cancel();

      return;
    }

    this.parts = [];
    this.region = [];
    this.message = "";
    this.options.changed();
  }

  all() {
    if (!this.busy) this.selectRegion({ shape: "all", points: [] });
  }

  copy(): void {
    if (!this.busy && this.hasSelection) {
      this.clipboard.strokes = SelectionUtils.copy(this.selected);
      this.clipboard.region = BoardRegions.cloneMask(this.outline);
      this.message = "Фрагмент скопирован в этой вкладке.";
      this.options.changed();
    }
  }

  remove(cut = false): void {
    if (this.busy || !this.options.writable() || !this.hasSelection) return;

    try {
      const candidate = SelectionCandidates.candidate(
        this.options.scene.strokes,
        this.parts,
        SelectionConfig.ZERO,
        true,
      );

      const buffer = cut ? SelectionUtils.copy(this.selected) : null;
      const region = BoardRegions.cloneMask(this.outline);

      this.apply(candidate, [], (success) => {
        if (success && buffer) {
          this.clipboard.strokes = buffer;
          this.clipboard.region = region;
        }
      });
    } catch (error) {
      this.report(error);
    }

    this.options.changed();
  }

  insert(duplicate = false): void {
    if (this.busy || !this.options.writable()) return;

    try {
      const originals = duplicate ? this.selected : this.buffer;

      if (!originals.length) return;

      const insertion = SelectionClipboardTransforms.prepare(
        this.options.scene.strokes,
        originals,
        duplicate ? this.outline : (this.clipboard.region ?? []),
        this.options.viewport(),
        this.options.bounds(),
        duplicate,
      );

      if (!insertion) return;

      this.apply(insertion.candidate, insertion.region);
    } catch (error) {
      this.report(error);
    }

    this.options.changed();
  }

  nudge(x: number, y: number): void {
    if (
      this.gesture.pointerId !== null ||
      this.operation.busy ||
      !this.options.writable() ||
      !this.hasSelection
    )
      return;

    this.nudging = true;

    this.delta = {
      x: this.delta.x + x / this.options.viewport().zoom,
      y: this.delta.y + y / this.options.viewport().zoom,
    };

    this.previewMove();
    this.options.changed();
  }

  finishNudge() {
    if (this.nudging && !this.operation.busy) this.finishMove();
  }

  edgePan(screen: Position, elapsed: number): boolean {
    if (!this.gesture.moving) return false;

    const bounds = this.options.bounds(),
      viewport = this.options.viewport();

    const speed = (p: number, size: number) =>
      p < 32
        ? 600 * Math.min(1, (32 - p) / 32) ** 2
        : p > size - 32
          ? -600 * Math.min(1, (p - size + 32) / 32) ** 2
          : 0;

    const x =
      speed(screen.x, bounds.width) * Math.min(0.05, Math.max(0, elapsed));

    const y =
      speed(screen.y, bounds.height) * Math.min(0.05, Math.max(0, elapsed));

    if (!x && !y) return false;

    this.options.setViewport({
      ...viewport,
      x: viewport.x + x,
      y: viewport.y + y,
    });

    this.move({
      pointerId: this.gesture.pointerId!,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: screen.x + bounds.left,
      clientY: screen.y + bounds.top,
      pressure: 0,
      timeStamp: 0,
    });

    return true;
  }
}

export const BoardSelectionHelpers = {
  prepareSelection: SelectionUtils.prepareSelection,
};

export type { SelectionPreview, SelectionClipboard } from "./selection.types";
