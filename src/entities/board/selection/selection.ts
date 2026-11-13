import { SelectionTransform } from "./modules/transform";
import { BoardTransforms } from "../transforms";
import type { AffineMatrix } from "../board.types";
import { SelectionGesture } from "./modules/gesture";
import { SelectionCandidates } from "./selection-candidates";
import { SelectionOperation } from "./selection-operation";
import { SelectionClipboardTransforms } from "./selection-clipboard";
import {
  type SelectionShape,
  type ClipMask,
  type Viewport,
  type BoardItem,
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
  private readonly transformGesture = new SelectionTransform();
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

  private get buffer(): BoardItem[] {
    return this.clipboard.strokes;
  }

  private delta: Position = { ...SelectionConfig.ZERO };
  private nudging = false;
  message = "";

  constructor(private readonly options: SelectionOptions) {}

  get pointerId(): number | null {
    return this.transformGesture.pointerId ?? this.gesture.pointerId;
  }

  get busy(): boolean {
    return this.pointerId !== null || this.nudging || this.operation.busy;
  }

  get moving(): boolean {
    return this.gesture.moving;
  }

  get hasClipboard(): boolean {
    return this.buffer.length > 0;
  }

  get selected(): BoardItem[] {
    if (this.transformGesture.pointerId !== null)
      return this.parts.map((part) =>
        BoardTransforms.apply(part.selected, this.transformGesture.matrix),
      );

    return this.parts.map((part) =>
      SelectionUtils.shifted(part.selected, this.delta),
    );
  }

  get hasSelection(): boolean {
    return this.parts.length > 0;
  }

  get outline(): ClipMask {
    if (this.transformGesture.region) return this.transformGesture.region;

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

  handles() {
    return this.hasSelection
      ? this.transformGesture.handles(
          this.outline,
          this.options.viewport().zoom,
        )
      : [];
  }

  down(event: PointerInput): boolean {
    if (
      !this.busy &&
      this.hasSelection &&
      this.options.writable() &&
      event.isPrimary &&
      event.button === 0 &&
      event.buttons === 1 &&
      this.transformGesture.down(
        event.pointerId,
        this.world(event),
        this.region,
        this.options.viewport().zoom,
      )
    ) {
      this.message = "";
      this.options.changed();

      return true;
    }

    if (this.busy || !this.gesture.down(event)) return false;

    this.delta = { ...SelectionConfig.ZERO };
    this.previewBase = null;
    this.message = "";
    this.options.changed();

    return true;
  }

  move(event: PointerInput): boolean {
    if (this.transformGesture.pointerId !== null) {
      if (event.pointerId !== this.transformGesture.pointerId) return false;

      if (event.buttons !== 1) {
        this.cancel();

        return true;
      }

      try {
        const matrix = this.transformGesture.move(
          this.world(event),
          event.shiftKey,
        );

        if (matrix) this.previewTransform(matrix);

        this.options.changed();
      } catch (error) {
        this.cancel();
        this.report(error);
      }

      return true;
    }

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
      shiftKey: event.shiftKey,
    });

    if (this.transformGesture.pointerId !== null) {
      const matrix = this.transformGesture.matrix;

      this.transformGesture.cancel();
      this.commitTransform(matrix);

      return true;
    }

    const released = this.gesture.release();

    if (released.kind === "drag") this.finishMove(released.viewport);
    else if (released.kind === "region") this.selectRegion(released.input);

    return true;
  }

  private transformedCandidate(matrix: AffineMatrix) {
    const candidate = SelectionCandidates.candidate(
      this.options.scene.strokes,
      this.parts,
      SelectionConfig.ZERO,
    );

    const mapping = new Map(
      candidate.selected.map((item) => [
        item,
        BoardTransforms.apply(item, matrix),
      ]),
    );

    return {
      strokes: candidate.strokes.map((item) => mapping.get(item) ?? item),
      selected: candidate.selected.map((item) => mapping.get(item)!),
    };
  }

  private previewTransform(matrix: AffineMatrix) {
    if (!this.previewBase) this.previewMove();

    const selected = this.previewBase!.selected.map((item) =>
        BoardTransforms.apply(item, matrix),
      ),
      mapping = new Map(
        this.previewBase!.selected.map((item, index) => [
          item,
          selected[index]!,
        ]),
      );

    this.options.preview({
      stationary: this.previewBase!.stationary,
      selected,
      ordered: this.previewBase!.ordered?.map((entry) =>
        entry.selected
          ? { item: mapping.get(entry.item)!, selected: true }
          : entry,
      ),
      delta: { x: 0, y: 0 },
      transformed: true,
    });
  }

  private commitTransform(matrix: AffineMatrix) {
    if (
      matrix.every((v, i) => Math.abs(v - BoardTransforms.IDENTITY[i]!) < 1e-12)
    ) {
      this.options.preview(null);
      this.options.changed();

      return;
    }

    try {
      this.apply(
        this.transformedCandidate(matrix),
        BoardTransforms.mask(this.region, matrix),
        () => {
          this.options.preview(null);
          this.options.changed();
        },
      );
    } catch (error) {
      this.options.preview(null);
      this.report(error);
    }
  }

  transform(widthPercent: number, heightPercent: number, angle: number) {
    if (this.busy || !this.options.writable() || !this.hasSelection) return;

    const bounds = BoardRegions.maskBounds(this.region);

    if (!bounds) return;

    try {
      this.commitTransform(
        BoardTransforms.around(
          {
            x: (bounds.left + bounds.right) / 2,
            y: (bounds.top + bounds.bottom) / 2,
          },
          widthPercent / 100,
          heightPercent / 100,
          angle,
        ),
      );
    } catch (error) {
      this.report(error);
    }
  }

  insertItems(items: BoardItem[]): Promise<boolean> {
    if (this.busy || !this.options.writable()) return Promise.resolve(false);

    const bounds = BoardRegions.visibleBounds(items);

    if (!bounds) return Promise.resolve(false);

    return new Promise((resolve) =>
      this.apply(
        { strokes: [...this.options.scene.strokes, ...items], selected: items },
        BoardRegions.rectangle(
          { x: bounds.left, y: bounds.top },
          { x: bounds.right, y: bounds.bottom },
        ),
        resolve,
      ),
    );
  }

  cropImages() {
    if (this.busy || !this.options.writable()) return;

    const images = new Map(
      this.parts
        .filter((p) => p.selected.kind === "image")
        .map((p) => [p.original, p.selected]),
    );

    if (!images.size) return;

    this.apply({
      strokes: this.options.scene.strokes.map(
        (item) => images.get(item) ?? item,
      ),
      selected: this.parts.map((p) => images.get(p.original) ?? p.selected),
      parts: this.parts.map((part) => {
        const image = images.get(part.original);

        return image
          ? { original: image, selected: image, remainder: null }
          : part;
      }),
    });
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
        ...(this.options.scene.strokes.some((item) => item.kind === "image")
          ? {
              ordered: this.options.scene.strokes.flatMap((item) => {
                const part = byOriginal.get(item);

                if (!part) return [{ item, selected: false }];

                return [
                  ...(part.remainder
                    ? [{ item: part.remainder, selected: false }]
                    : []),
                  { item: part.selected, selected: true },
                ];
              }),
            }
          : {}),
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
      strokes: BoardItem[];
      selected: BoardItem[];
      parts?: SelectedPart[];
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

        this.parts =
          candidate.parts ??
          candidate.selected.map((stroke) => ({
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

    this.transformGesture.cancel();
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

  capture() {
    if (this.busy || !this.hasSelection) return null;

    const scene = [...this.options.scene.strokes],
      parts = this.parts,
      region = this.region;

    return {
      fragment: {
        strokes: this.selected,
        region: BoardRegions.cloneMask(this.outline),
      },
      current: () =>
        !this.busy &&
        this.parts === parts &&
        this.region === region &&
        scene.length === this.options.scene.strokes.length &&
        scene.every((item, i) => item === this.options.scene.strokes[i]),
    };
  }

  removeCaptured(
    capture: NonNullable<ReturnType<BoardSelection["capture"]>>,
  ): Promise<boolean> {
    if (!capture.current() || !this.options.writable())
      return Promise.resolve(false);

    try {
      const candidate = SelectionCandidates.candidate(
        this.options.scene.strokes,
        this.parts,
        SelectionConfig.ZERO,
        true,
      );

      return new Promise((resolve) => this.apply(candidate, [], resolve));
    } catch (error) {
      this.report(error);

      return Promise.resolve(false);
    }
  }

  insertFragment(fragment: SelectionClipboard): Promise<boolean> {
    if (this.busy || !this.options.writable()) return Promise.resolve(false);

    try {
      const insertion = SelectionClipboardTransforms.prepare(
        this.options.scene.strokes,
        fragment.strokes,
        fragment.region ?? [],
        this.options.viewport(),
        this.options.bounds(),
        false,
      );

      if (!insertion) return Promise.resolve(false);

      return new Promise((resolve) =>
        this.apply(insertion.candidate, insertion.region, resolve),
      );
    } catch (error) {
      this.report(error);

      return Promise.resolve(false);
    }
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
