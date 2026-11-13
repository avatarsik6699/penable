import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardImagePage } from "./board-image-page";
import type { TestBoardTypes } from "../data/board.types";
import type { TestImageTypes } from "../data/image-files";

export class BoardLibraryPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async open() {
    const trigger = this.page.getByRole("button", {
      name: "Доски",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  private async catalog() {
    const catalog = (await this.board.storage.records()).catalog;

    if (!catalog) throw new Error("Board library catalog missing");

    return catalog;
  }

  private async activeTitle() {
    const catalog = await this.catalog();

    return catalog.boards.find((entry) => entry.id === catalog.activeId)?.title;
  }

  async create(title: string) {
    await this.open();

    await this.page
      .getByRole("button", { name: "Новая доска", exact: true })
      .click();

    await this.page
      .getByRole("textbox", { name: "Название новой доски", exact: true })
      .fill(title);

    await this.page
      .getByRole("button", { name: "Создать доску", exact: true })
      .click();

    await expect.poll(() => this.activeTitle()).toBe(title);
    await this.board.storage.expectSaved();
    await this.page.keyboard.press("Escape");
  }

  async switchTo(title: string) {
    await this.open();

    await this.page
      .getByRole("button", { name: `Открыть доску: ${title}`, exact: true })
      .click();

    await expect.poll(() => this.activeTitle()).toBe(title);
    await this.board.storage.expectSaved();
    await this.page.keyboard.press("Escape");
  }

  private async rename(from: string, to: string) {
    await this.open();

    await this.page
      .getByRole("button", { name: `Действия доски: ${from}`, exact: true })
      .click();

    await this.page
      .getByLabel(`Переименовать доску: ${from}`, { exact: true })
      .click();

    await this.page
      .getByRole("textbox", { name: "Название доски", exact: true })
      .fill(to);

    await this.page
      .getByRole("button", { name: "Сохранить название", exact: true })
      .click();

    await expect.poll(() => this.activeTitle()).toBe(to);
    await this.page.keyboard.press("Escape");
  }

  private async remove(title: string, confirm: boolean) {
    await this.open();

    await this.page
      .getByRole("button", { name: `Действия доски: ${title}`, exact: true })
      .click();

    await this.page
      .getByLabel(`Удалить доску: ${title}`, { exact: true })
      .click();

    const dialog = this.page.getByRole("alertdialog", {
      name: "Удалить доску?",
      exact: true,
    });

    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(title);

    await dialog
      .getByRole("button", {
        name: confirm ? "Удалить доску" : "Отмена",
        exact: true,
      })
      .click();

    await expect(dialog).toBeHidden();
    await this.board.storage.expectSaved();
    await this.page.keyboard.press("Escape");
  }

  async expectIndependentBoardsAndDeletion() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const main = (await this.board.storage.records()).main!;

    await this.create("Черновик");
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
    await this.rename("Черновик", "Конспект");
    await this.board.drawStroke({ x: 400, y: 330 }, { x: 620, y: 400 });
    await this.board.storage.expectStrokeCount(1);

    const second = (await this.board.storage.records()).main!;

    expect(second.items).not.toEqual(main.items);
    await this.switchTo("Моя доска");
    await this.board.storage.expectScene(main.items);
    await this.board.expectUndoUnavailable();
    await this.switchTo("Конспект");
    await this.board.storage.expectScene(second.items);
    await this.board.reopenSavedBoard();
    expect(await this.activeTitle()).toBe("Конспект");
    await this.board.storage.expectScene(second.items);

    const catalog = await this.catalog();

    await this.remove("Конспект", false);
    expect(await this.catalog()).toEqual(catalog);
    await this.remove("Конспект", true);
    await expect.poll(() => this.activeTitle()).toBe("Моя доска");
    await this.board.storage.expectScene(main.items);
    await this.open();

    await this.page
      .getByRole("button", { name: "Действия доски: Моя доска", exact: true })
      .click();

    await expect(
      this.page.getByLabel("Удалить доску: Моя доска", { exact: true }),
    ).toBeDisabled();
  }

  async expectImageClipboardAndScopedRecovery(
    image: BoardImagePage,
    file: TestImageTypes.File,
    empty: TestBoardTypes.Document,
  ) {
    await image.insert(file);
    await image.expectImages(1);

    const original = (await this.board.storage.records()).main!;

    await image.copyAll();
    await this.create("Иллюстрации");
    await image.pasteInternal();
    await image.expectImages(1);

    const copied = (await this.board.storage.records()).main!;

    expect(copied.assets).toHaveLength(1);
    expect(copied.assets[0]!.base64).toBe(original.assets[0]!.base64);
    await this.board.storage.importDocument(empty);
    await this.board.storage.expectRecovery("previous", copied);
    await this.switchTo("Моя доска");
    await this.board.storage.expectScene(original.items);

    expect((await this.board.storage.records()).main!.assets).toEqual(
      original.assets,
    );

    expect((await this.board.storage.records()).previous).toBeUndefined();
    await this.remove("Иллюстрации", true);
    await image.pasteInternal();
    await image.expectImages(2);

    const duplicated = (await this.board.storage.records()).main!;

    expect(duplicated.assets).toHaveLength(1);
    expect(duplicated.assets[0]!.base64).toBe(original.assets[0]!.base64);
    await this.board.reopenSavedBoard();
    await image.expectImages(2);
    await this.board.storage.expectExportMatchesSaved();
  }

  async prepareFailureTarget() {
    await this.create("Чистая доска");
    await this.switchTo("Моя доска");
    await this.board.reopenSavedBoard();
  }

  async expectFailedSavePreventsSwitch(release: () => Promise<void>) {
    const before = await this.catalog();

    await this.board.drawPendingInk();
    await this.board.storage.expectSaveError();
    await this.open();

    await this.page
      .getByRole("button", { name: "Открыть доску: Чистая доска", exact: true })
      .click();

    await expect(
      this.page
        .getByText(/Не удалось сохранить|не сохранен|не сохранён/)
        .first(),
    ).toBeVisible();

    expect((await this.catalog()).activeId).toBe(before.activeId);
    await this.page.keyboard.press("Escape");
    await release();
    await this.board.storage.retrySave();
    await this.board.storage.expectStrokeCount(1);

    const restored = (await this.board.storage.records()).main!;

    await this.switchTo("Чистая доска");
    await this.board.storage.expectStrokeCount(0);
    await this.switchTo("Моя доска");
    await this.board.storage.expectScene(restored.items);
  }

  async expectSidebarSearchAndPreviews() {
    await this.create("Алгебра");
    await this.create("Геометрия");
    await this.board.drawStroke({ x: 350, y: 300 }, { x: 560, y: 380 });
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;
    const canvas = await this.board.surface.elementHandle();
    const box = await this.board.surface.boundingBox();

    const dock = this.page.getByRole("group", {
      name: "Инструменты доски",
      exact: true,
    });

    const dockBox = await dock.boundingBox();

    await this.open();

    const sidebar = this.page.getByRole("complementary", {
      name: "Мои доски",
      exact: true,
    });

    const search = sidebar.getByRole("searchbox", {
      name: "Поиск досок",
      exact: true,
    });

    await expect(sidebar).toBeVisible();
    expect(await this.board.surface.boundingBox()).toEqual(box);

    expect(
      await this.board.surface.evaluate(
        (current, old) => current === old,
        canvas,
      ),
    ).toBe(true);

    await search.fill("геом");

    await expect(
      sidebar.getByRole("button", { name: /^Открыть доску:/ }),
    ).toHaveCount(1);

    const row = sidebar.getByRole("listitem").filter({
      has: this.page.getByRole("button", {
        name: "Открыть доску: Геометрия",
        exact: true,
      }),
    });

    await expect(row.locator("img")).toHaveAttribute("src", /^blob:/);

    await expect
      .poll(() =>
        row
          .locator("img")
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);

    await search.fill("совпадений нет");

    await expect(
      sidebar.getByText("Доски не найдены", { exact: true }),
    ).toBeVisible();

    await search.fill("");
    await this.page.keyboard.press("Escape");

    await expect(
      this.page.getByRole("button", { name: "Доски", exact: true }),
    ).toBeFocused();

    const long =
      "Очень длинное название доски для проверки стабильной верхней панели и поиска";

    await this.rename("Геометрия", long);
    expect(await dock.boundingBox()).toEqual(dockBox);
    await this.board.storage.expectScene(original);
    await canvas?.dispose();
  }

  async expectRenameFocusAndTitleHierarchy() {
    const title =
      "Конспект с длинным названием для проверки панели и переименования";

    await this.create(title);

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 1000, height: 720 },
      { width: 390, height: 844 },
      { width: 390, height: 568 },
    ]) {
      await this.page.setViewportSize(viewport);

      const trigger = this.page.getByRole("button", {
        name: "Доски",
        exact: true,
      });

      const hierarchy = await trigger.evaluate((button) => {
        const label = button.querySelector("span")!;
        const name = button.querySelector("[data-testid=active-board-title]")!;

        return {
          labelSize: Number.parseFloat(getComputedStyle(label).fontSize),
          nameSize: Number.parseFloat(getComputedStyle(name).fontSize),
          labelBottom: label.getBoundingClientRect().bottom,
          nameTop: name.getBoundingClientRect().top,
          text: name.textContent,
          height: button.getBoundingClientRect().height,
        };
      });

      expect(hierarchy.nameSize).toBeGreaterThan(hierarchy.labelSize);
      expect(hierarchy.nameTop).toBeGreaterThanOrEqual(hierarchy.labelBottom);
      expect(hierarchy.text).toBe(title);
      expect(hierarchy.height).toBe(40);

      const surfaceBox = await this.board.surface.boundingBox();

      await this.open();

      await this.page
        .getByRole("button", { name: "Действия доски: Моя доска", exact: true })
        .click();

      await this.page
        .getByLabel("Переименовать доску: Моя доска", { exact: true })
        .click();

      const field = this.page.getByRole("textbox", {
        name: "Название доски",
        exact: true,
      });

      await field.scrollIntoViewIfNeeded();
      await expect(field).toBeFocused();
      await field.fill("321");

      const focus = await field.evaluate((input) => {
        const style = getComputedStyle(input);

        const ring =
          Number.parseFloat(style.outlineWidth) +
          Number.parseFloat(style.outlineOffset);

        const box = input.getBoundingClientRect();
        const list = input.closest("ul")!;
        const clip = list.getBoundingClientRect();

        return {
          style: style.outlineStyle,
          ring,
          gaps: [
            box.left - clip.left - list.clientLeft,
            clip.left + list.clientLeft + list.clientWidth - box.right,
            box.top - clip.top - list.clientTop,
            clip.top + list.clientTop + list.clientHeight - box.bottom,
          ],
          overflow: list.scrollWidth - list.clientWidth,
        };
      });

      expect(focus.style).not.toBe("none");
      expect(focus.ring).toBeGreaterThan(0);

      for (const gap of focus.gaps)
        expect(gap).toBeGreaterThanOrEqual(focus.ring - 0.5);

      expect(focus.overflow).toBeLessThanOrEqual(1);
      expect(await this.board.surface.boundingBox()).toEqual(surfaceBox);

      await this.page
        .getByRole("button", { name: "Отмена", exact: true })
        .click();

      await this.page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
    }
  }
}
