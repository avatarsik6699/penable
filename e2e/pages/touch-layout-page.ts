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

      const expectedSize =
        size.width >= 838
          ? { width: 814, height: 60 }
          : size.width >= 423
            ? { width: 399, height: 112 }
            : { width: 294, height: 164 };

      expect(before!.width).toBe(expectedSize.width);
      expect(before!.height).toBe(expectedSize.height);
      expect(before!.x).toBeGreaterThanOrEqual(-1);
      expect(before!.x + before!.width).toBeLessThanOrEqual(size.width + 1);

      expect(
        Math.abs(before!.x - (size.width - before!.width) / 2),
      ).toBeLessThanOrEqual(1);

      expect(before!.y).toBeLessThanOrEqual(24);

      const names = [
        "Доски",
        "Вставить изображение",
        "Фигуры и заготовки",
        "Перо",
        "Ластик",
        "Выделение",
        "Отменить действие",
        "Вернуть действие",
        "Состояние сохранения",
        "Настройки доски",
      ];

      const buttons = await Promise.all(
        names.map((name) =>
          this.page.getByRole("button", { name, exact: true }).boundingBox(),
        ),
      );

      const chooser = buttons[0]!;

      expect(chooser.width).toBe(128);

      const slider = await this.page
        .getByRole("slider", { name: "Толщина", exact: true })
        .boundingBox();

      const colorPreview = this.page.getByRole("button", {
        name: "Выбрать цвет",
        exact: true,
      });

      const preview = await colorPreview.boundingBox();

      const contextWidth = await colorPreview.evaluate(
        (button) => button.parentElement?.getBoundingClientRect().width ?? 0,
      );

      expect(contextWidth).toBe(178);

      const controls = [...buttons, preview, slider];

      for (const control of controls) {
        expect(control).not.toBeNull();
        expect(control!.x).toBeGreaterThanOrEqual(before!.x - 1);
        expect(control!.y).toBeGreaterThanOrEqual(before!.y - 1);

        expect(control!.x + control!.width).toBeLessThanOrEqual(
          before!.x + before!.width + 1,
        );

        expect(control!.y + control!.height).toBeLessThanOrEqual(
          before!.y + before!.height + 1,
        );
      }

      for (let first = 0; first < controls.length; first += 1) {
        for (let second = first + 1; second < controls.length; second += 1) {
          const a = controls[first]!;
          const b = controls[second]!;

          const overlapWidth =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);

          const overlapHeight =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

          expect(overlapWidth <= 0.5 || overlapHeight <= 0.5).toBe(true);
        }
      }

      const sameRow = (boxes: typeof controls) => {
        const centers = boxes.map((box) => box!.y + box!.height / 2);

        expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(
          2,
        );
      };

      const board = buttons[0]!;
      const primary = buttons.slice(1, 6);
      const history = buttons.slice(6, 8);
      const trailing = buttons.slice(8);

      if (size.width >= 838) {
        sameRow([...buttons, preview, slider]);
      } else if (size.width >= 423) {
        sameRow([board, ...primary]);
        sameRow([...history, preview, slider, ...trailing]);
        expect(board.y).toBeLessThan(history[0]!.y);
      } else {
        sameRow([board, ...trailing]);
        sameRow(primary);
        sameRow([preview, slider, ...history]);
        expect(board.y).toBeLessThan(primary[0]!.y);
        expect(primary[0]!.y).toBeLessThan(preview!.y);
      }

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
      { width: 422, height: 844 },
      { width: 423, height: 844 },
      { width: 600, height: 844 },
      { width: 830, height: 844 },
      { width: 837, height: 844 },
      { width: 838, height: 844 },
      { width: 844, height: 390 },
      { width: 568, height: 320 },
    ]);
  }

  async expectTabletLayouts() {
    await this.matrix([
      { width: 768, height: 1024 },
      { width: 834, height: 1112 },
      { width: 837, height: 1024 },
      { width: 838, height: 1024 },
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
