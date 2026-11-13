import { expect, type Page } from "@playwright/test";
import type { TestBoardTypes } from "../data/board.types";
import type { StoragePage } from "./storage-page";

export class BoardPage {
  readonly surface;

  constructor(
    private readonly page: Page,
    readonly storage: StoragePage,
    private readonly releaseFailure?: () => Promise<void>,
  ) {
    this.surface = page.getByLabel(
      "Область письма и стирания пером или основной кнопкой мыши",
      { exact: true },
    );
  }

  async open() {
    await this.page.goto("/penable/");
    await this.storage.expectSaved();
    await expect(this.surface).toBeVisible();
  }

  async reopenSavedBoard() {
    await this.page.reload();
    await this.storage.expectSaved();
  }

  private async absolute(point: TestBoardTypes.Position) {
    const box = await this.surface.boundingBox();

    if (!box) throw new Error("Board surface missing");

    return { x: box.x + point.x, y: box.y + point.y };
  }

  private async move(point: TestBoardTypes.Position, steps = 1) {
    const absolute = await this.absolute(point);

    await this.page.mouse.move(absolute.x, absolute.y, { steps });
  }

  private async writeStroke(
    from = { x: 100, y: 100 },
    to = { x: 380, y: 150 },
  ) {
    await this.page.getByRole("button", { name: "Перо", exact: true }).click();
    await this.move(from);
    await this.page.mouse.down();
    await this.move(to, 30);
    await this.page.mouse.up();
  }

  async drawStroke(from = { x: 100, y: 100 }, to = { x: 380, y: 150 }) {
    await this.writeStroke(from, to);
    await this.storage.expectSaved();
  }

  async drawPendingInk() {
    await this.writeStroke();
  }

  async drawAndExpectExactCommitRaster() {
    await this.page.getByRole("button", { name: "Перо", exact: true }).click();
    await this.move({ x: 100, y: 100 });
    await this.page.mouse.down();
    await this.move({ x: 320, y: 160 }, 24);

    await this.page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );

    const active = await this.surface.evaluate((canvas) =>
      (canvas as HTMLCanvasElement).toDataURL(),
    );

    await this.page.mouse.up();

    const completed = this.page.locator("canvas[data-layer=completed]");

    await expect
      .poll(() =>
        completed.evaluate((canvas) =>
          (canvas as HTMLCanvasElement).toDataURL(),
        ),
      )
      .toBe(active);

    await this.storage.expectStrokeCount(1);

    const ink = (await this.storage.records()).main!.strokes[0]!;

    expect(ink.points.length).toBeGreaterThan(10);
    expect(ink.points[0]!.x).toBeCloseTo(100, 5);
    expect(ink.points.at(-1)!.x).toBeCloseTo(320, 5);
  }

  async undo() {
    await this.page
      .getByRole("button", { name: "Отменить действие", exact: true })
      .click();
  }

  async redo() {
    await this.page
      .getByRole("button", { name: "Вернуть действие", exact: true })
      .click();
  }

  async expectUndoUnavailable() {
    await expect(
      this.page.getByRole("button", { name: "Отменить действие", exact: true }),
    ).toBeDisabled();
  }

  async selectRectangle(
    from: TestBoardTypes.Position,
    to: TestBoardTypes.Position,
  ) {
    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.page.getByRole("button", { name: "Рамка", exact: true }).click();
    await this.move(from);
    await this.page.mouse.down();
    await this.move(to, 10);
    await this.page.mouse.up();

    await expect(
      this.page.getByRole("button", { name: "Рамка", exact: true }),
    ).toBeEnabled();
  }

  private outline() {
    return this.page.locator(
      "svg.selection-outline path, [data-testid=board-selection] path",
    );
  }

  async expectSelectionSize(width: number, height: number) {
    const path = await this.outline().getAttribute("d");
    const numbers = path?.match(/-?[0-9]+(?:\.[0-9]+)?/g)?.map(Number);

    expect(numbers).toBeTruthy();
    expect(numbers![2]! - numbers![0]!).toBeCloseTo(width, 5);
    expect(numbers![5]! - numbers![1]!).toBeCloseTo(height, 5);
  }

  async moveSelection(
    from: TestBoardTypes.Position,
    to: TestBoardTypes.Position,
  ) {
    await this.move(from);
    await this.page.mouse.down();
    await this.move(to, 12);
    await this.page.mouse.up();

    await expect(
      this.page.getByRole("button", { name: "Рамка", exact: true }),
    ).toBeEnabled();
  }

  async expectPartialMove(x: number, y: number) {
    await expect
      .poll(async () => {
        const strokes = (await this.storage.records()).main?.strokes ?? [];

        return strokes.some(
          (stroke) =>
            stroke.clip &&
            stroke.translation?.x === x &&
            stroke.translation?.y === y,
        );
      })
      .toBe(true);

    await this.storage.expectSaved();
  }

  async erase(from: TestBoardTypes.Position, to: TestBoardTypes.Position) {
    await this.page
      .getByRole("button", { name: "Ластик", exact: true })
      .click();

    await this.move(from);
    await this.page.mouse.down();
    await this.move(to, 10);
    await this.page.mouse.up();
  }

  async cancelStroke() {
    await this.page.getByRole("button", { name: "Перо", exact: true }).click();
    await this.move({ x: 500, y: 150 });
    await this.page.mouse.down();
    await this.move({ x: 580, y: 190 }, 10);
    await this.page.keyboard.press("Escape");
    await this.page.mouse.up();
  }

  async expectViewportChangesOnly() {
    const original = (await this.storage.records()).main!.strokes;

    await this.move({ x: 600, y: 200 });
    await this.page.mouse.wheel(120, 80);

    await this.page
      .getByRole("button", { name: "Увеличить масштаб доски", exact: true })
      .click();

    await expect
      .poll(async () => (await this.storage.records()).main?.viewport.zoom)
      .toBeGreaterThan(1);

    expect((await this.storage.records()).main!.strokes).toEqual(original);
  }

  async tryDrawingReadOnly() {
    await this.move({ x: 200, y: 100 });
    await this.page.mouse.down();
    await this.move({ x: 280, y: 140 }, 12);
    await this.page.mouse.up();
  }

  async retryFailedWorkerSave() {
    if (!this.releaseFailure)
      throw new Error("No owned worker failure configured");

    await this.releaseFailure();
    await this.storage.retrySave();
  }

  async expectDistinctWorkerPaths() {
    await expect.poll(() => this.page.workers().length).toBe(2);

    for (const worker of this.page.workers()) {
      expect(new URL(worker.url()).pathname).toMatch(
        /^\/penable\/assets\/jobs-worker-[\w-]+\.js$/,
      );
    }
  }

  async expectNarrowLayout() {
    await this.page.setViewportSize({ width: 390, height: 844 });

    await expect(
      this.page.getByRole("button", { name: "Перо", exact: true }),
    ).toBeVisible();

    await expect(
      this.page.getByRole("button", { name: "Хранение", exact: true }),
    ).toBeVisible();

    await expect(this.surface).toBeVisible();

    const box = await this.surface.boundingBox();

    expect(box!.width).toBeLessThanOrEqual(390);
    expect(box!.height).toBeGreaterThan(200);
  }
}
