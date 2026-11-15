import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import { BoardLibraryPage } from "./board-library-page";

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
        "Доски",
        "Вставить изображение",
        "Фигуры и заготовки",
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

  private async expectPanelTail(
    name: string,
    tail: string,
    role: "dialog" | "complementary" = "dialog",
  ) {
    const panel = this.page.getByRole(role, { name, exact: true });

    await expect(panel).toBeVisible();

    await expect
      .poll(() =>
        panel.evaluate((element) => {
          const bounds = element.getBoundingClientRect();

          return Math.max(-bounds.top, bounds.bottom - innerHeight + 8);
        }),
      )
      .toBeLessThanOrEqual(1);

    const button = panel.getByRole("button", { name: tail, exact: true });

    await button.scrollIntoViewIfNeeded();

    const bounds = (await button.boundingBox())!;
    const viewport = this.page.viewportSize()!;

    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height - 7);
  }

  async expectCompactContentPanelsReachable() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);
    await this.page.setViewportSize({ width: 390, height: 844 });
    await this.page.getByRole("button", { name: "Доски", exact: true }).click();

    await this.page
      .getByRole("button", { name: "Новая доска", exact: true })
      .click();

    await this.expectPanelTail("Мои доски", "Создать доску", "complementary");
    await this.page.setViewportSize({ width: 390, height: 568 });
    await this.expectPanelTail("Мои доски", "Создать доску", "complementary");
    await this.page.keyboard.press("Escape");

    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    const actions = this.page.getByRole("button", {
      name: "Действия",
      exact: true,
    });

    await actions.click();

    await this.page
      .getByRole("button", { name: "Выделить всё", exact: true })
      .click();

    await actions.click();

    await this.page
      .getByRole("button", { name: "Преобразовать", exact: true })
      .click();

    for (const size of [
      { width: 390, height: 568 },
      { width: 390, height: 844 },
      { width: 1280, height: 720 },
    ]) {
      await this.page.setViewportSize(size);
      await this.expectPanelTail("Действия с выделением", "Снять выделение");
    }

    await this.page.keyboard.press("Escape");
    await this.board.storage.expectStrokeCount(1);
  }

  async expectInvariantDockGeometry() {
    const library = new BoardLibraryPage(this.page, this.board);

    await library.create(
      "Математика — длинное название конспекта для проверки панели",
    );

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 390, height: 844 },
      { width: 406, height: 720 },
      { width: 407, height: 720 },
      { width: 422, height: 720 },
      { width: 423, height: 720 },
      { width: 600, height: 844 },
      { width: 650, height: 844 },
      { width: 651, height: 844 },
      { width: 768, height: 720 },
      { width: 801, height: 720 },
      { width: 802, height: 720 },
      { width: 830, height: 720 },
      { width: 837, height: 720 },
      { width: 838, height: 720 },
      { width: 899, height: 720 },
      { width: 900, height: 720 },
      { width: 1000, height: 720 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 1254, height: 900 },
      { width: 1200, height: 720 },
      { width: 1199, height: 720 },
      { width: 390, height: 568 },
    ]) {
      await this.page.setViewportSize(viewport);

      const dock = this.page.getByRole("group", {
        name: "Инструменты доски",
        exact: true,
      });

      const tools = ["Перо", "Ластик", "Выделение"];

      const buttons = [
        "Доски",
        "Вставить изображение",
        "Фигуры и заготовки",
        ...tools,
        "Отменить действие",
        "Вернуть действие",
        "Состояние сохранения",
        "Настройки доски",
      ];

      await this.page
        .getByRole("button", { name: tools[0]!, exact: true })
        .click();

      const expectedDock = (await dock.boundingBox())!;

      const expectedButtons = await Promise.all(
        buttons.map((name) =>
          this.page.getByRole("button", { name, exact: true }).boundingBox(),
        ),
      );

      expect(expectedDock.width).toBeLessThanOrEqual(viewport.width - 24);

      const denseWidth = viewport.width < 407 ? 286 : 383;

      const expectedSize =
        viewport.width >= 802
          ? { width: 778, height: 56 }
          : { width: denseWidth, height: viewport.width < 407 ? 152 : 104 };

      expect(expectedDock.width).toBe(expectedSize.width);
      expect(expectedDock.height).toBe(expectedSize.height);
      expect(expectedDock.x).toBeGreaterThanOrEqual(-1);

      expect(expectedDock.x + expectedDock.width).toBeLessThanOrEqual(
        viewport.width + 1,
      );

      expect(
        Math.abs(expectedDock.x - (viewport.width - expectedDock.width) / 2),
      ).toBeLessThanOrEqual(1);

      expect(expectedButtons[0]!.width).toBe(128);
      expect(expectedButtons.every((button) => button !== null)).toBe(true);

      const slider = this.page.getByRole("slider", {
        name: "Толщина",
        exact: true,
      });

      const expectedSlider = (await slider.boundingBox())!;

      const colorPreview = this.page.getByRole("button", {
        name: "Выбрать цвет",
        exact: true,
      });

      const preview = await colorPreview.boundingBox();

      const contextWidth = await colorPreview.evaluate(
        (button) => button.parentElement?.getBoundingClientRect().width ?? 0,
      );

      expect(contextWidth).toBe(178);

      const contextBoxes = [preview, expectedSlider];
      const controlBoxes = [...expectedButtons, ...contextBoxes];

      for (const box of controlBoxes) {
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(expectedDock.x - 1);
        expect(box!.y).toBeGreaterThanOrEqual(expectedDock.y - 1);

        expect(box!.x + box!.width).toBeLessThanOrEqual(
          expectedDock.x + expectedDock.width + 1,
        );

        expect(box!.y + box!.height).toBeLessThanOrEqual(
          expectedDock.y + expectedDock.height + 1,
        );
      }

      for (let first = 0; first < controlBoxes.length; first += 1) {
        for (
          let second = first + 1;
          second < controlBoxes.length;
          second += 1
        ) {
          const a = controlBoxes[first]!;
          const b = controlBoxes[second]!;

          const overlapWidth =
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);

          const overlapHeight =
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

          expect(overlapWidth <= 0.5 || overlapHeight <= 0.5).toBe(true);
        }
      }

      const sameRow = (
        boxes: ({
          x: number;
          y: number;
          width: number;
          height: number;
        } | null)[],
      ) => {
        const centers = boxes.map((box) => box!.y + box!.height / 2);

        expect(Math.max(...centers) - Math.min(...centers)).toBeLessThanOrEqual(
          2,
        );
      };

      const board = expectedButtons[0]!;
      const primary = expectedButtons.slice(1, 6);
      const history = expectedButtons.slice(6, 8);
      const trailing = expectedButtons.slice(8);

      if (viewport.width >= 802) {
        sameRow([...expectedButtons, ...contextBoxes]);
      } else if (viewport.width >= 407) {
        sameRow([board, ...primary]);
        sameRow([...history, ...contextBoxes, ...trailing]);
        expect(board.y).toBeLessThan(history[0]!.y);
      } else {
        sameRow([board, ...trailing]);
        sameRow(primary);
        sameRow([...contextBoxes, ...history]);
        expect(board.y).toBeLessThan(primary[0]!.y);
        expect(primary[0]!.y).toBeLessThan(preview!.y);
      }

      expect(
        await this.page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);

      if (viewport.width >= 802) {
        expect(expectedDock.width).toBe(778);
        expect(expectedDock.height).toBe(56);

        for (const button of expectedButtons) {
          expect(button!.y).toBe(expectedButtons[0]!.y);
        }
      }

      for (const tool of tools.slice(1)) {
        const target = this.page.getByRole("button", {
          name: tool,
          exact: true,
        });

        await target.click();
        await expect(target).toHaveAttribute("aria-pressed", "true");

        const actualDock = (await dock.boundingBox())!;

        const context =
          tool === "Ластик"
            ? this.page.getByText("Штрих целиком", { exact: true })
            : this.page.getByRole("region", {
                name: "Действия выделения",
                exact: true,
              });

        const contextBox = (await context.boundingBox())!;

        expect(contextBox.x).toBeGreaterThanOrEqual(actualDock.x);
        expect(contextBox.y).toBeGreaterThanOrEqual(actualDock.y);

        expect(contextBox.x + contextBox.width).toBeLessThanOrEqual(
          actualDock.x + actualDock.width,
        );

        expect(contextBox.y + contextBox.height).toBeLessThanOrEqual(
          actualDock.y + actualDock.height,
        );

        for (const key of ["x", "y", "width", "height"] as const)
          expect(
            Math.abs(actualDock[key] - expectedDock[key]),
          ).toBeLessThanOrEqual(1);

        for (const [index, name] of buttons.entries()) {
          const actual = (await this.page
            .getByRole("button", { name, exact: true })
            .boundingBox())!;

          const original = expectedButtons[index]!;

          for (const key of ["x", "y", "width", "height"] as const)
            expect(Math.abs(actual[key] - original[key])).toBeLessThanOrEqual(
              1,
            );
        }
      }
    }
  }
}
