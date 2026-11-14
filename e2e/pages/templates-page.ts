import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardTransformPage } from "./board-transform-page";
import type { BoardLibraryPage } from "./board-library-page";
import type { TestBoardTypes } from "../data/board.types";

export class TemplatesPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async open(name: string) {
    await this.page
      .getByRole("button", { name: "Фигуры и заготовки", exact: true })
      .click();

    await this.page.getByRole("button", { name, exact: true }).click();
  }

  private async arm(name: string) {
    await this.open(name);

    await this.page
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .click();

    await expect(
      this.page.getByText("Нажмите на доску для вставки · Esc — отмена", {
        exact: true,
      }),
    ).toBeVisible();
  }

  private async place() {
    await this.board.surface.click({ position: { x: 420, y: 420 } });
    await this.board.storage.expectSaved();
  }

  async expectAllTemplatesRemainVectorAfterReload() {
    for (const name of [
      "Отрезок",
      "Стрелка",
      "Прямоугольник",
      "Эллипс",
      "Треугольник",
      "Числовая прямая",
      "Оси XY",
      "Тригонометрическая окружность",
    ]) {
      const count = (await this.board.storage.records()).main!.items.length;

      await this.arm(name);
      await this.board.storage.expectStrokeCount(count);
      await this.place();
      await this.board.storage.expectStrokeCount(count + 1);

      await expect(
        this.page.getByTestId("selection-handles"),
      ).not.toHaveAttribute("d", "");
    }

    const saved = (await this.board.storage.records()).main!;

    expect(saved.items.map((item) => item.kind)).toEqual(
      Array(8).fill("template"),
    );

    expect(saved.assets).toEqual([]);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(saved.items);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectPlacementCancellationAndHistory() {
    await this.arm("Оси XY");
    await this.page.mouse.move(550, 450);
    await this.page.keyboard.press("Escape");
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();

    await expect(
      this.page.getByText("Нажмите на доску для вставки · Esc — отмена", {
        exact: true,
      }),
    ).toBeHidden();

    await this.arm("Оси XY");
    await this.place();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectScene(original);
    await this.board.erase({ x: 250, y: 420 }, { x: 590, y: 420 });
    await this.board.storage.expectScene(original);
  }

  async expectTransformAndExactPartialMove(transforms: BoardTransformPage) {
    await this.arm("Тригонометрическая окружность");
    await this.place();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await transforms.numeric(125, 125, 30);

    await expect
      .poll(async () => (await this.board.storage.records()).main!.items)
      .not.toEqual(original);

    const transformed = (await this.board.storage.records()).main!.items;

    await this.board.undo();
    await this.board.storage.expectScene(original);
    await this.board.redo();
    await this.board.storage.expectScene(transformed);
    await this.board.selectRectangle({ x: 250, y: 230 }, { x: 420, y: 600 });
    await this.board.moveSelection({ x: 330, y: 350 }, { x: 370, y: 380 });

    const split = (await this.board.storage.records()).main!.items;

    expect(split.length).toBeGreaterThan(1);

    expect(split.every((item) => item.kind === "template" && item.clip)).toBe(
      true,
    );

    await this.board.undo();
    await this.board.storage.expectScene(transformed);
    await this.board.redo();
    await this.board.storage.expectScene(split);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(split);
  }

  async expectOrdinaryCrossBoardClipboard(library: BoardLibraryPage) {
    await this.arm("Оси XY");
    await this.place();
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+x");
    await this.board.storage.expectStrokeCount(0);
    await library.create("Математика из буфера");
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await this.board.storage.expectStrokeCount(1);

    expect((await this.board.storage.records()).main!.items[0]!.kind).toBe(
      "template",
    );

    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(1);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectInvalidParametersBlockPlacement() {
    await this.open("Оси XY");

    const place = this.page.getByRole("button", {
      name: "Разместить на доске",
      exact: true,
    });

    await this.page
      .getByRole("radio", { name: "Шаг вручную", exact: true })
      .check();

    const step = this.page.getByLabel("Шаг делений", { exact: true });

    await step.fill("0.001");
    await expect(place).toBeDisabled();
    await expect(this.page.getByRole("alert")).toContainText(/делени/i);
    await this.board.storage.expectStrokeCount(0);
    await step.fill("1");
    await expect(place).toBeEnabled();

    await this.page.getByLabel("До", { exact: true }).fill("-10");

    await expect(place).toBeDisabled();
    await this.board.storage.expectStrokeCount(0);
    await this.page.keyboard.press("Escape");
    await this.board.expectUndoUnavailable();
  }

  async expectToolAndBoardSwitchCancelPlacement(library: BoardLibraryPage) {
    await this.arm("Прямоугольник");

    await this.page
      .getByRole("button", { name: "Ластик", exact: true })
      .click();

    await expect(
      this.page.getByText("Нажмите на доску для вставки · Esc — отмена", {
        exact: true,
      }),
    ).toBeHidden();

    await this.board.storage.expectStrokeCount(0);
    await this.arm("Оси XY");
    await library.create("Без незавершённой заготовки");

    await expect(
      this.page.getByText("Нажмите на доску для вставки · Esc — отмена", {
        exact: true,
      }),
    ).toBeHidden();

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectLegacyClipboardStillEditable(
    document: TestBoardTypes.StoredDocument,
  ) {
    await this.page.evaluate(async (source) => {
      const payload = {
        format: "penable-fragment",
        schemaVersion: 1,
        document: source,
        region: [
          [
            [
              [0, 0],
              [200, 0],
              [200, 200],
              [0, 200],
              [0, 0],
            ],
          ],
        ],
      };

      await navigator.clipboard.write([
        new ClipboardItem({
          "web application/x-penable-fragment+json": new Blob(
            [JSON.stringify(payload)],
            { type: "application/x-penable-fragment+json" },
          ),
        }),
      ]);
    }, document);

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await this.board.storage.expectStrokeCount(1);

    const source = document.items[0]!;
    const actual = (await this.board.storage.records()).main!.items[0]!;

    if (source.kind !== "ink" || actual.kind !== "ink")
      throw new Error("Expected editable legacy ink");

    expect(actual.points).toEqual(source.points);
    expect(actual.width).toBe(source.width);
    expect(actual.stabilization).toEqual(source.stabilization);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(1);
  }

  async expectOutlineAndFillAreIndependent() {
    await this.open("Прямоугольник");

    await this.page
      .getByRole("button", { name: "Цвет: Красный", exact: true })
      .click();

    await this.page.getByRole("checkbox", { name: /Заливка/ }).check();

    await this.page
      .getByRole("button", { name: "Цвет заливки: Синий", exact: true })
      .click();

    await this.page
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .click();

    await this.place();
    await this.board.storage.expectStrokeCount(1);

    const item = (await this.board.storage.records()).main!.items[0]!;

    if (item.kind !== "template")
      throw new Error("Expected a single rectangle");

    expect(item.template.color).toBe("#d92d20");
    expect(item.template.fill).toBe("#175cd3");

    const color = await this.page
      .locator("canvas[data-layer=completed]")
      .evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const box = canvas.getBoundingClientRect();

        const sample = Object.assign(document.createElement("canvas"), {
          width: 1,
          height: 1,
        });

        const context = sample.getContext("2d", { willReadFrequently: true })!;

        context.drawImage(
          canvas,
          Math.round((420 * canvas.width) / box.width),
          Math.round((420 * canvas.height) / box.height),
          1,
          1,
          0,
          0,
          1,
          1,
        );

        return [...context.getImageData(0, 0, 1, 1).data];
      });

    expect(color).toEqual([23, 92, 211, 255]);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([item]);
  }

  async expectInstrumentChangeCancelsPlacement() {
    await this.arm("Прямоугольник");
    await this.page.getByRole("button", { name: "Перо", exact: true }).click();
    await this.page.getByRole("radio", { name: "Маркер", exact: true }).check();

    await expect(
      this.page.getByText("Нажмите на доску для вставки · Esc — отмена", {
        exact: true,
      }),
    ).toBeHidden();

    const bounds = (await this.board.surface.boundingBox())!;

    await this.page.mouse.move(bounds.x + 250, bounds.y + 350);
    await this.page.mouse.down();
    await this.page.mouse.move(bounds.x + 450, bounds.y + 350, { steps: 20 });
    await this.page.mouse.up();
    await this.board.storage.expectStrokeCount(1);

    const item = (await this.board.storage.records()).main!.items[0]!;

    if (item.kind !== "ink")
      throw new Error(
        "Instrument change must draw ink, not the stale template",
      );

    expect(item.style?.instrument).toBe("highlighter");
  }

  async expectVisiblePlacementAndKeyboardFocus() {
    await this.open("Оси XY");

    const place = this.page.getByRole("button", {
      name: "Разместить на доске",
      exact: true,
    });

    const presentation = await place.evaluate((element) => {
      const style = getComputedStyle(element);

      const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);

      const luminance = (value: number[]) =>
        value
          .slice(0, 3)
          .map((channel) => {
            const normalized = channel / 255;

            return normalized <= 0.04045
              ? normalized / 12.92
              : ((normalized + 0.055) / 1.055) ** 2.4;
          })
          .reduce(
            (sum, channel, index) =>
              sum + channel * [0.2126, 0.7152, 0.0722][index]!,
            0,
          );

      const background = rgb(style.backgroundColor);
      const foreground = rgb(style.color);

      const a = luminance(background),
        b = luminance(foreground);

      return {
        alpha: background[3] ?? 1,
        contrast: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });

    expect(presentation.alpha).toBe(1);
    expect(presentation.contrast).toBeGreaterThanOrEqual(4.5);

    const swatch = this.page.getByRole("button", {
      name: "Цвет: Синий",
      exact: true,
    });

    await swatch.focus();
    await this.page.keyboard.press("Tab");
    await this.page.keyboard.press("Shift+Tab");
    await expect(swatch).toBeFocused();

    const focus = await swatch.evaluate((element) => {
      const style = getComputedStyle(element);

      return {
        width: parseFloat(style.outlineWidth),
        style: style.outlineStyle,
      };
    });

    expect(focus.style).toBe("solid");
    expect(focus.width).toBeGreaterThanOrEqual(2);
  }
}
