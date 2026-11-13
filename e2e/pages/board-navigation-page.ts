import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { TestBoardTypes } from "../data/board.types";

export class BoardNavigationPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly releaseOverviewFailure?: () => Promise<void>,
  ) {}

  private async saved() {
    await this.board.storage.expectSaved();

    return (await this.board.storage.records()).main!;
  }

  private async expectWritingView(
    view: NonNullable<TestBoardTypes.Document["lastWritingView"]>,
  ) {
    await expect
      .poll(async () => {
        const record = (await this.board.storage.records()).main;
        const box = await this.board.surface.boundingBox();

        if (!record || !box) return null;

        const current = record.viewport;

        return {
          x: (box.width / 2 - current.x) / current.zoom,
          y: (box.height / 2 - current.y) / current.zoom,
          zoom: current.zoom,
        };
      })
      .toEqual({ x: view.center.x, y: view.center.y, zoom: view.zoom });
  }

  async expectWritingReturnAndBackgroundRoundtrip() {
    await this.board.drawStroke();

    const original = await this.saved();
    const writing = original.lastWritingView;

    expect(writing).toBeTruthy();
    await this.board.cancelStroke();
    await this.board.storage.expectScene(original.items);
    expect((await this.saved()).lastWritingView).toEqual(writing);
    await this.board.erase({ x: 180, y: 112 }, { x: 220, y: 125 });
    await this.board.storage.expectStrokeCount(0);
    expect((await this.saved()).lastWritingView).toEqual(writing);
    await this.board.undo();
    await this.board.storage.expectScene(original.items);
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");
    await this.page.keyboard.press("Control+c");
    await this.page.keyboard.press("Control+v");
    await this.board.storage.expectStrokeCount(2);
    expect((await this.saved()).lastWritingView).toEqual(writing);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(1);
    await this.board.storage.openBoardMenu();
    await this.page.getByRole("button", { name: "Точки", exact: true }).click();

    await this.page
      .getByRole("slider", { name: "Контраст фона", exact: true })
      .fill("70");

    await this.page
      .getByRole("slider", { name: "Шаг фона", exact: true })
      .fill("40");

    await this.page.keyboard.press("Escape");

    await expect
      .poll(
        async () =>
          (await this.board.storage.records()).main?.backgroundSettings,
      )
      .toEqual({ contrast: 70, spacing: 40 });

    await this.board.expectViewportChangesOnly();

    const beforeReset = await this.saved();

    expect(beforeReset.items).toEqual(original.items);

    const box = (await this.board.surface.boundingBox())!;

    const center = {
      x: (box.width / 2 - beforeReset.viewport.x) / beforeReset.viewport.zoom,
      y: (box.height / 2 - beforeReset.viewport.y) / beforeReset.viewport.zoom,
    };

    await this.page.getByRole("button", { name: /Установить 100%/ }).click();
    await this.expectWritingView({ center, zoom: 1 });
    expect((await this.saved()).lastWritingView).toEqual(writing);
    await this.page.setViewportSize({ width: 1440, height: 720 });

    await this.page
      .getByRole("button", { name: "К месту письма", exact: true })
      .click();

    await this.expectWritingView(writing!);
    await this.board.reopenSavedBoard();

    const loaded = await this.saved();

    expect(loaded.backgroundSettings).toEqual({ contrast: 70, spacing: 40 });
    expect(loaded.background).toBe("dots");
    expect(loaded.lastWritingView).toEqual(writing);

    const exported = await this.board.storage.exportDocument();

    await this.board.storage.importDocument(exported);

    const imported = await this.saved();

    expect(imported.backgroundSettings).toEqual(exported.backgroundSettings);
    expect(imported.lastWritingView).toEqual(writing);
    expect(imported.items).toEqual(exported.items);
    await this.board.storage.openFiles();

    await expect(
      this.page.getByRole("button", { name: "Скачать копию", exact: true }),
    ).toHaveCount(1);

    await expect(
      this.page.getByRole("button", { name: "Импорт", exact: true }),
    ).toHaveCount(1);
  }

  async expectOverviewNavigation(document: TestBoardTypes.Document) {
    await this.board.storage.importDocument(document);

    const mapToggle = this.page.getByRole("button", {
      name: "Миникарта",
      exact: true,
    });

    await expect(mapToggle).toHaveAttribute("aria-expanded", "false");

    const originalWorkers = this.page.workers();

    await mapToggle.click();

    const overview = this.page.getByTestId("board-minimap");

    await expect(overview).toBeVisible();

    await expect(
      this.page.getByRole("region", { name: "Миникарта доски", exact: true }),
    ).toHaveAttribute("aria-busy", "false");

    await expect
      .poll(() => this.page.workers().length)
      .toBe(originalWorkers.length + 1);

    const mapWorker = this.page
      .workers()
      .find((worker) => !originalWorkers.includes(worker));

    expect(mapWorker).toBeTruthy();

    await expect(
      this.page.getByRole("button", {
        name: "Показать все записи",
        exact: true,
      }),
    ).toBeDisabled();

    const original = await this.saved();

    const size = await overview.evaluate((element) => ({
      width: (element as HTMLCanvasElement).width,
      height: (element as HTMLCanvasElement).height,
    }));

    expect(size.width).toBeLessThanOrEqual(512);
    expect(size.height).toBeLessThanOrEqual(320);

    const preview = await overview.evaluate((element) =>
      (element as HTMLCanvasElement).toDataURL(),
    );

    const area = (await overview.boundingBox())!;

    await overview.click({
      position: { x: area.width * 0.85, y: area.height / 2 },
    });

    await expect
      .poll(async () => (await this.board.storage.records()).main?.viewport.x)
      .not.toBe(original.viewport.x);

    const jumped = await this.saved();

    expect(jumped.viewport.zoom).toBe(original.viewport.zoom);
    expect(jumped.lastWritingView).toEqual(document.lastWritingView);

    expect(
      await overview.evaluate((element) =>
        (element as HTMLCanvasElement).toDataURL(),
      ),
    ).toBe(preview);

    await this.page
      .getByRole("button", { name: "К месту письма", exact: true })
      .click();

    await this.expectWritingView(document.lastWritingView!);

    await this.page
      .getByRole("button", { name: "Настройки доски", exact: true })
      .click();

    await expect(overview).toBeHidden();

    await expect
      .poll(() => this.page.workers().includes(mapWorker!))
      .toBe(false);

    for (const worker of originalWorkers)
      expect(this.page.workers()).toContain(worker);

    await this.page.keyboard.press("Escape");

    const remaining = this.page.workers();

    await mapToggle.click();
    await expect(overview).toBeVisible();

    await expect(
      this.page.getByRole("region", { name: "Миникарта доски", exact: true }),
    ).toHaveAttribute("aria-busy", "false");

    const reopenedWorker = this.page
      .workers()
      .find((worker) => !remaining.includes(worker));

    expect(reopenedWorker).toBeTruthy();
    await mapToggle.click();
    await expect(overview).toBeHidden();

    await expect
      .poll(() => this.page.workers().includes(reopenedWorker!))
      .toBe(false);

    await this.board.storage.expectScene(document.strokes);
  }

  async expectOverviewFailureRecovery() {
    if (!this.releaseOverviewFailure)
      throw new Error("No owned overview fault configured");

    const toggle = this.page.getByRole("button", {
      name: "Миникарта",
      exact: true,
    });

    const region = this.page.getByRole("region", {
      name: "Миникарта доски",
      exact: true,
    });

    await toggle.click();
    await expect(region).toContainText("Не удалось подготовить обзор");
    await this.board.storage.expectSaved();
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(2);
    await expect(region).toBeVisible();
    await this.releaseOverviewFailure();
    await toggle.click();
    await toggle.click();
    await expect(region).toHaveAttribute("aria-busy", "false");
    await expect(region).not.toContainText("Не удалось подготовить обзор");
    await expect(this.page.getByTestId("board-minimap")).toBeVisible();
    await this.board.storage.expectStrokeCount(2);
  }
}
