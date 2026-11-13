import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardLibraryPage } from "./board-library-page";
import { appearanceBoards } from "../data/appearance-boards";

export class BoardAppearancePage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly library: BoardLibraryPage,
    private readonly writeFault?: (active: boolean) => Promise<void>,
    private readonly faultHits?: () => Promise<number>,
  ) {}

  private async catalog() {
    const catalog = (await this.board.storage.records()).catalog;

    if (!catalog || catalog.schemaVersion !== 2)
      throw new Error("Expected migrated appearance catalog");

    return catalog;
  }

  private async appearance(title: string) {
    const board = (await this.catalog()).boards.find(
      (board) => board.title === title,
    );

    if (!board) throw new Error("Board appearance missing");

    return board.appearance;
  }

  private sidebar() {
    return this.page.getByRole("complementary", {
      name: "Мои доски",
      exact: true,
    });
  }

  private async open() {
    const trigger = this.page.getByRole("button", {
      name: "Доски",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  private action(title: string) {
    return this.page.getByRole("button", {
      name: `Действия доски: ${title}`,
      exact: true,
    });
  }

  private editor(title: string) {
    return this.page.getByRole("region", {
      name: `Оформление доски: ${title}`,
      exact: true,
    });
  }

  private async edit(title: string) {
    await this.open();
    await this.action(title).click();

    await this.page
      .getByRole("menuitem", {
        name: `Оформление доски: ${title}`,
        exact: true,
      })
      .click();

    await expect(this.editor(title)).toBeVisible();
    await expect(this.sidebar().getByRole("searchbox")).toHaveCount(0);
  }

  private async select(title: string, color: string, icon: string) {
    const editor = this.editor(title);

    await editor.getByRole("radio", { name: color, exact: true }).check();
    await editor.getByRole("radio", { name: icon, exact: true }).check();
  }

  private async save(title: string) {
    await this.editor(title)
      .getByRole("button", { name: "Сохранить оформление", exact: true })
      .click();

    await expect(this.editor(title)).toBeHidden();
    await expect(this.action(title)).toBeFocused();
  }

  async expectStableEditableCovers() {
    await this.board.drawStroke();

    const original = (await this.board.storage.records()).main!;
    const first = await this.appearance("Моя доска");

    await this.library.create("Языки");

    const second = await this.appearance("Языки");

    expect(second).not.toEqual(first);
    await this.edit("Языки");
    await this.select("Языки", "Фиолетовый", "Книга");
    await this.save("Языки");

    expect(await this.appearance("Языки")).toEqual({
      color: "violet",
      icon: "book",
    });

    await this.page.keyboard.press("Escape");
    await this.board.reopenSavedBoard();

    expect(await this.appearance("Языки")).toEqual({
      color: "violet",
      icon: "book",
    });

    await this.open();
    await this.action("Языки").click();

    await this.page
      .getByRole("menuitem", {
        name: "Переименовать доску: Языки",
        exact: true,
      })
      .click();

    await this.page
      .getByRole("textbox", { name: "Название доски", exact: true })
      .fill("Английский язык");

    await this.page
      .getByRole("button", { name: "Сохранить название", exact: true })
      .click();

    await expect
      .poll(() => this.appearance("Английский язык"))
      .toEqual({ color: "violet", icon: "book" });

    await this.page.keyboard.press("Escape");
    await this.library.switchTo("Моя доска");
    await this.board.storage.expectScene(original.items);
    await this.edit("Моя доска");
    await this.select("Моя доска", "Фиолетовый", "Книга");
    await this.save("Моя доска");

    expect(await this.appearance("Моя доска")).toEqual(
      await this.appearance("Английский язык"),
    );

    await this.board.storage.expectScene(original.items);
  }

  async expectDraftCancelAndKeyboard() {
    const title = "Моя доска",
      original = await this.appearance(title);

    const box = await this.board.surface.boundingBox();

    await this.edit(title);
    await this.select(title, "Розовый", "Книга");
    expect(await this.appearance(title)).toEqual(original);

    await this.editor(title)
      .getByRole("button", { name: "Отмена", exact: true })
      .click();

    await expect(this.action(title)).toBeFocused();
    expect(await this.appearance(title)).toEqual(original);
    await this.edit(title);
    await this.select(title, "Зелёный", "Книга");
    await this.page.keyboard.press("Escape");
    await expect(this.sidebar()).toBeHidden();

    await expect(
      this.page.getByRole("button", { name: "Доски", exact: true }),
    ).toBeFocused();

    expect(await this.appearance(title)).toEqual(original);
    await this.edit(title);

    await this.editor(title)
      .getByRole("radio", { name: "Синий", exact: true })
      .focus();

    await this.page.keyboard.press("ArrowRight");

    await expect(
      this.editor(title).getByRole("radio", { name: "Бирюзовый", exact: true }),
    ).toBeChecked();

    await this.editor(title)
      .getByRole("radio", { name: "Блокнот", exact: true })
      .focus();

    await this.page.keyboard.press("ArrowRight");

    await expect(
      this.editor(title).getByRole("radio", { name: "Книга", exact: true }),
    ).toBeChecked();

    await this.save(title);

    expect(await this.appearance(title)).toEqual({
      color: "teal",
      icon: "book",
    });

    expect(await this.board.surface.boundingBox()).toEqual(box);
  }

  async expectCompactEditor() {
    for (const viewport of [
      { width: 390, height: 844 },
      { width: 390, height: 568 },
      { width: 1000, height: 720 },
    ]) {
      await this.page.setViewportSize(viewport);

      const box = await this.board.surface.boundingBox();

      await this.edit("Моя доска");
      await this.select("Моя доска", "Синий", "Книга");

      const save = this.editor("Моя доска").getByRole("button", {
        name: "Сохранить оформление",
        exact: true,
      });

      await save.scrollIntoViewIfNeeded();

      const bounds = (await save.boundingBox())!;

      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
      expect(await this.board.surface.boundingBox()).toEqual(box);
      await this.save("Моя доска");
      await this.page.keyboard.press("Escape");
    }
  }

  async expectMigrationAndDistinctCatalog() {
    const records = await this.board.storage.records(),
      catalog = await this.catalog();

    expect(records.beforeCatalog2).toEqual(appearanceBoards.catalog());
    expect(catalog.boards).toHaveLength(100);

    expect(
      new Set(
        catalog.boards.map(
          (board) => `${board.appearance.color}/${board.appearance.icon}`,
        ),
      ).size,
    ).toBe(100);

    await this.open();

    await expect(
      this.sidebar().getByRole("button", { name: /^Открыть доску:/ }),
    ).toHaveCount(100);

    await expect(this.sidebar().locator("img")).toHaveCount(0);

    const signatures = await this.sidebar()
      .getByRole("button", { name: /^Открыть доску:/ })
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const icon = button.querySelector("svg")!;

          return `${getComputedStyle(icon.parentElement!).backgroundColor}/${icon.innerHTML}`;
        }),
      );

    expect(new Set(signatures).size).toBe(100);

    await this.sidebar()
      .getByRole("searchbox", { name: "Поиск досок", exact: true })
      .fill("Доска 100");

    await expect(
      this.sidebar().getByRole("button", { name: /^Открыть доску:/ }),
    ).toHaveCount(1);

    await expect(
      this.sidebar()
        .getByRole("button", { name: "Открыть доску: Доска 100", exact: true })
        .locator("svg"),
    ).toBeVisible();

    const workers = await this.page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => /preview-loader|thumbnail-worker/.test(name)),
    );

    expect(workers).toEqual([]);
    await this.page.keyboard.press("Escape");
    await this.board.reopenSavedBoard();
    expect(await this.catalog()).toEqual(catalog);

    expect((await this.board.storage.records()).beforeCatalog2).toEqual(
      appearanceBoards.catalog(),
    );
  }

  async expectFailedSavePreservesDraft() {
    if (!this.writeFault) throw new Error("Appearance fault port missing");

    const title = "Моя доска",
      before = await this.catalog();

    await this.edit(title);
    await this.select(title, "Фиолетовый", "Книга");
    await this.writeFault(true);

    await this.editor(title)
      .getByRole("button", { name: "Сохранить оформление", exact: true })
      .click();

    await expect(this.editor(title).getByRole("alert")).toBeVisible();
    expect(await this.faultHits?.()).toBeGreaterThan(0);
    expect(await this.catalog()).toEqual(before);

    await expect(
      this.editor(title).getByRole("radio", {
        name: "Фиолетовый",
        exact: true,
      }),
    ).toBeChecked();

    await expect(
      this.editor(title).getByRole("radio", { name: "Книга", exact: true }),
    ).toBeChecked();

    await this.writeFault(false);
    await this.save(title);

    expect(await this.appearance(title)).toEqual({
      color: "violet",
      icon: "book",
    });
  }

  async expectFailedMigrationPreservesOriginal() {
    const records = await this.board.storage.records();

    expect(records.catalog).toEqual(appearanceBoards.catalog());
    expect(records.beforeCatalog2).toBeUndefined();
    expect(await this.faultHits?.()).toBeGreaterThan(0);
    expect(records.main!.items).toEqual([]);
    await expect(this.board.surface).toBeHidden();
  }

  async expectReadOnlyWithoutMigration() {
    const before = await this.board.storage.records();

    expect(before.catalog).toEqual(appearanceBoards.catalog());
    expect(before.beforeCatalog2).toBeUndefined();
    await this.open();

    await expect(
      this.sidebar().getByRole("button", { name: /^Открыть доску:/ }),
    ).toHaveCount(100);

    await expect(this.action("Доска 1")).toBeDisabled();

    await expect(
      this.sidebar().getByRole("button", { name: "Новая доска", exact: true }),
    ).toBeDisabled();

    await expect(
      this.sidebar()
        .getByRole("button", { name: "Открыть доску: Доска 1", exact: true })
        .locator("svg"),
    ).toBeVisible();

    expect((await this.board.storage.records()).catalog).toEqual(
      before.catalog,
    );

    expect((await this.board.storage.records()).beforeCatalog2).toBeUndefined();
  }
}
