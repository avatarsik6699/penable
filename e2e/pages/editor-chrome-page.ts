import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";

export class EditorChromePage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  async expectStableDisclosures() {
    const surface = this.board.surface;
    const original = await surface.elementHandle();
    const initialBox = await surface.boundingBox();

    const bitmap = await surface.evaluate((canvas) => ({
      width: (canvas as HTMLCanvasElement).width,
      height: (canvas as HTMLCanvasElement).height,
    }));

    const before = (await this.board.storage.records()).main;
    const pen = this.page.getByRole("button", { name: "Перо", exact: true });

    const boardMenu = this.page.getByRole("button", {
      name: "Настройки доски",
      exact: true,
    });

    const save = this.page.getByRole("button", {
      name: "Состояние сохранения",
      exact: true,
    });

    const help = this.page.getByRole("button", { name: "Помощь", exact: true });

    await pen.focus();
    await this.page.keyboard.press("Enter");

    await expect(
      this.page.getByRole("slider", { name: "Стабилизация", exact: true }),
    ).toBeVisible();

    await expect(pen).toHaveAttribute("aria-expanded", "true");
    await this.page.keyboard.press("Escape");
    await expect(pen).toBeFocused();
    await expect(pen).toHaveAttribute("aria-expanded", "false");

    for (const trigger of [boardMenu, save, help, pen]) {
      await trigger.focus();
      await this.page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");

      await expect(this.page.getByRole("dialog")).toHaveCount(1);

      expect(await surface.boundingBox()).toEqual(initialBox);

      expect(
        await surface.evaluate(
          (current, previous) => current === previous,
          original,
        ),
      ).toBe(true);
    }

    await this.page.keyboard.press("Escape");
    await expect(pen).toBeFocused();

    expect(
      await surface.evaluate((canvas) => ({
        width: (canvas as HTMLCanvasElement).width,
        height: (canvas as HTMLCanvasElement).height,
      })),
    ).toEqual(bitmap);

    expect((await this.board.storage.records()).main).toEqual(before);
    await this.board.expectUndoUnavailable();

    await boardMenu.click();
    await surface.click({ position: { x: 600, y: 500 } });
    await expect(boardMenu).toHaveAttribute("aria-expanded", "false");
    await this.board.storage.expectStrokeCount(1);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await original?.dispose();
  }

  async expectDesktopAndCompactLayout() {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
    ]) {
      await this.page.setViewportSize(size);
      await expect(this.board.surface).toBeVisible();

      const board = await this.board.surface.boundingBox();

      expect(board!.width).toBeLessThanOrEqual(size.width);
      expect(board!.height).toBeGreaterThan(size.height - 2);

      const bounds = [];

      for (const name of [
        "Настройки доски",
        "Перо",
        "Состояние сохранения",
        "Помощь",
        "Миникарта",
      ]) {
        const button = this.page.getByRole("button", { name, exact: true });

        await expect(button).toBeVisible();

        const box = await button.boundingBox();

        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);
        expect(box!.y + box!.height).toBeLessThanOrEqual(size.height + 1);
        expect(box!.width).toBeGreaterThanOrEqual(40);
        expect(box!.height).toBeGreaterThanOrEqual(40);
        bounds.push(box!);
      }

      for (let i = 0; i < bounds.length; i++) {
        for (const other of bounds.slice(i + 1)) {
          const box = bounds[i]!;

          expect(
            box.x < other.x + other.width &&
              box.x + box.width > other.x &&
              box.y < other.y + other.height &&
              box.y + box.height > other.y,
          ).toBe(false);
        }
      }

      await this.page
        .getByRole("button", { name: "Настройки доски", exact: true })
        .click();

      await expect(
        this.page.getByRole("tab", { name: "Вид", exact: true }),
      ).toBeVisible();

      await this.page.keyboard.press("Escape");
    }
  }
}
