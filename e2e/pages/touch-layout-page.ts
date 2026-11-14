import { expect, type Locator, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";

export class TouchLayoutPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly keyboard?: (height: number | null) => Promise<void>,
  ) {}

  private async contained(panel: Locator) {
    await expect(panel).toBeVisible();

    const box = (await panel.boundingBox())!;
    const viewport = this.page.viewportSize()!;

    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);

    const overflow = await panel.evaluate(
      (element) => element.scrollWidth - element.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(1);
  }

  private async matrix(sizes: { width: number; height: number }[]) {
    for (const size of sizes) {
      await this.page.setViewportSize(size);

      const dock = this.page.locator("[data-editor-dock]");
      const surface = await this.board.surface.boundingBox();
      const before = await dock.boundingBox();

      expect(before!.y).toBeLessThanOrEqual(24);

      for (const name of ["Перо", "Ластик", "Выделение", "Настройки доски"]) {
        const control = this.page.getByRole("button", { name, exact: true });

        await control.scrollIntoViewIfNeeded();

        const target = (await control.boundingBox())!;

        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }

      await this.page.getByRole("button", { name: "Перо", exact: true }).tap();

      const pen = this.page.getByRole("dialog", {
        name: "Параметры пера",
        exact: true,
      });

      await this.contained(pen);

      const finger = pen.getByRole("checkbox", {
        name: "Рисовать пальцем",
        exact: true,
      });

      await finger.scrollIntoViewIfNeeded();
      await expect(finger).toBeInViewport();

      for (const button of await pen
        .getByRole("group", { name: "Цвет линии", exact: true })
        .getByRole("button")
        .all()) {
        const target = (await button.boundingBox())!;

        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }

      await this.page
        .getByRole("button", { name: "Закрыть параметры пера", exact: true })
        .tap();

      await this.page
        .getByRole("button", { name: "Фигуры и заготовки", exact: true })
        .tap();

      const figures = this.page.getByRole("dialog", {
        name: "Фигуры и заготовки",
        exact: true,
      });

      await this.contained(figures);

      const place = figures.getByRole("button", {
        name: "Разместить на доске",
        exact: true,
      });

      await place.scrollIntoViewIfNeeded();
      await expect(place).toBeInViewport();

      await this.page
        .getByRole("button", { name: "Закрыть заготовки", exact: true })
        .tap();

      expect(await dock.boundingBox()).toEqual(before);
      expect(await this.board.surface.boundingBox()).toEqual(surface);

      expect(
        await this.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
    }

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectPhoneLayouts() {
    await this.matrix([
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]);
  }

  async expectTabletLayouts() {
    await this.matrix([
      { width: 768, height: 1024 },
      { width: 834, height: 1112 },
      { width: 1024, height: 768 },
      { width: 1366, height: 1024 },
    ]);
  }

  async expectLibraryAndSettings() {
    await this.page.setViewportSize({ width: 390, height: 844 });
    await this.page.getByRole("button", { name: "Доски", exact: true }).tap();

    const library = this.page.getByRole("complementary", {
      name: "Мои доски",
      exact: true,
    });

    await this.contained(library);

    const search = library.getByRole("searchbox", {
      name: "Поиск досок",
      exact: true,
    });

    expect(
      await search.evaluate((element) =>
        parseFloat(getComputedStyle(element).fontSize),
      ),
    ).toBeGreaterThanOrEqual(16);

    await this.page
      .getByRole("button", { name: "Новая доска", exact: true })
      .tap();

    const title = library.getByRole("textbox", {
      name: "Название новой доски",
      exact: true,
    });

    await title.fill("Сенсорная доска");

    await this.page
      .getByRole("button", { name: "Создать доску", exact: true })
      .tap();

    await this.board.storage.expectSaved();
    await expect(library).toBeHidden();

    await this.page
      .getByRole("button", { name: "Настройки доски", exact: true })
      .tap();

    const settings = this.page.getByRole("dialog", {
      name: "Настройки доски",
      exact: true,
    });

    await this.contained(settings);

    await settings
      .getByRole("tab", { name: "Файлы и копии", exact: true })
      .tap();

    await settings
      .getByRole("button", { name: "Скачать копию", exact: true })
      .scrollIntoViewIfNeeded();

    await expect(
      settings.getByRole("button", { name: "Скачать копию", exact: true }),
    ).toBeInViewport();

    await settings
      .getByRole("button", { name: "Закрыть настройки доски", exact: true })
      .tap();

    await this.board.storage.expectStrokeCount(0);
  }

  async expectKeyboardViewport() {
    if (!this.keyboard) throw new Error("Keyboard viewport fixture missing");

    await this.page.getByRole("button", { name: "Доски", exact: true }).tap();

    await this.page
      .getByRole("button", { name: "Новая доска", exact: true })
      .tap();

    const panel = this.page.getByRole("complementary", {
      name: "Мои доски",
      exact: true,
    });

    const title = panel.getByRole("textbox", {
      name: "Название новой доски",
      exact: true,
    });

    await title.fill("Клавиатура");
    await this.keyboard(430);

    await expect
      .poll(async () => {
        const box = (await panel.boundingBox())!;

        return box.y + box.height;
      })
      .toBeLessThanOrEqual(431);

    await title.scrollIntoViewIfNeeded();

    const field = (await title.boundingBox())!;

    expect(field.y).toBeGreaterThanOrEqual(0);
    expect(field.y + field.height).toBeLessThanOrEqual(431);

    await panel
      .getByRole("button", { name: "Создать доску", exact: true })
      .scrollIntoViewIfNeeded();

    const action = (await panel
      .getByRole("button", { name: "Создать доску", exact: true })
      .boundingBox())!;

    expect(action.y + action.height).toBeLessThanOrEqual(431);
    await this.keyboard(null);

    await panel
      .getByRole("button", { name: "Создать доску", exact: true })
      .tap();

    await this.board.storage.expectSaved();
    await expect(panel).toBeHidden();
  }
}
