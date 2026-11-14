import { expect, type Page, type Locator } from "@playwright/test";
import type { BoardPage } from "./board-page";

export class ToolPanelsPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async figures(name = "Оси XY") {
    await this.page
      .getByRole("button", { name: "Фигуры и заготовки", exact: true })
      .click();

    await this.page.getByRole("button", { name, exact: true }).click();

    return this.page.getByRole("dialog", {
      name: "Фигуры и заготовки",
      exact: true,
    });
  }

  private async fits(panel: Locator, scrolling: boolean) {
    await expect(panel).toBeVisible();

    const metrics = await panel.evaluate((element) => {
      const bounds = element.getBoundingClientRect();

      return {
        x: bounds.x,
        y: bounds.y,
        right: bounds.right,
        bottom: bounds.bottom,
        width: innerWidth,
        height: innerHeight,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      };
    });

    expect(metrics.x).toBeGreaterThanOrEqual(0);
    expect(metrics.y).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.width + 1);
    expect(metrics.bottom).toBeLessThanOrEqual(metrics.height + 1);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    if (!scrolling)
      expect(metrics.scrollHeight).toBeLessThanOrEqual(
        metrics.clientHeight + 1,
      );
  }

  async expectCompactPanels() {
    for (const size of [
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 390, height: 844 },
      { width: 1280, height: 540 },
    ]) {
      await this.page.setViewportSize(size);

      const dock = this.page.locator("[data-editor-dock]");
      const original = await dock.boundingBox();
      const surface = await this.board.surface.boundingBox();

      await this.page
        .getByRole("button", { name: "Перо", exact: true })
        .click();

      const pen = this.page.getByRole("dialog", {
        name: "Параметры пера",
        exact: true,
      });

      for (const name of ["Ручка", "Перо с нажимом", "Маркер"]) {
        await this.page.getByRole("radio", { name, exact: true }).check();
        await this.fits(pen, size.height < 720 || size.width < 651);
        expect(await dock.boundingBox()).toEqual(original);
      }

      await this.page.keyboard.press("Escape");

      const panel = await this.figures();

      for (const name of [
        "Оси XY",
        "Прямоугольник",
        "Тригонометрическая окружность",
      ]) {
        await this.page.getByRole("button", { name, exact: true }).click();

        if (name === "Прямоугольник")
          await this.page.getByRole("checkbox", { name: /Заливка/ }).check();

        await this.fits(panel, size.height < 720 || size.width < 651);

        await expect(
          this.page.getByRole("button", {
            name: "Разместить на доске",
            exact: true,
          }),
        ).toBeVisible();

        expect(await dock.boundingBox()).toEqual(original);
        expect(await this.board.surface.boundingBox()).toEqual(surface);
      }

      await expect(panel.getByLabel("Ширина", { exact: true })).toHaveCount(0);
      await expect(panel.getByLabel("Высота", { exact: true })).toHaveCount(0);
      await this.page.keyboard.press("Escape");
    }

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectExtremeRangeAndResize() {
    const panel = await this.figures();

    await panel.getByLabel("От", { exact: true }).fill("-10000");
    await panel.getByLabel("До", { exact: true }).fill("10000");

    const preview = panel.getByRole("img", {
      name: "Предварительный вид заготовки",
      exact: true,
    });

    await expect(preview).toBeVisible();
    await expect(preview).toContainText("0");

    await expect(
      panel.getByRole("button", { name: "Разместить на доске", exact: true }),
    ).toBeEnabled();

    await panel
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .click();

    await this.board.surface.click({ position: { x: 650, y: 430 } });
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items[0]!;

    if (original.kind !== "template")
      throw new Error("Expected mathematical template");

    expect(original.template.min).toBe(-10000);
    expect(original.template.max).toBe(10000);
    expect(original.template.step).toBeGreaterThan(1);

    // Readable math templates can extend beyond the initial view; bring handles into view.
    await this.page
      .getByRole("button", { name: "Уменьшить масштаб доски", exact: true })
      .click();

    await this.page
      .getByRole("button", { name: "Уменьшить масштаб доски", exact: true })
      .click();

    const path = (await this.page
      .getByTestId("selection-handles")
      .getAttribute("d"))!;

    const handles = [...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)h([\d.]+)v/g)];

    expect(handles.length).toBeGreaterThanOrEqual(4);

    const positions = handles.map((match) => ({
      x: Number(match[1]) + Number(match[3]) / 2,
      y: Number(match[2]) + Number(match[3]) / 2,
    }));

    const corner = positions.reduce((a, b) => (a.x + a.y > b.x + b.y ? a : b));
    const box = (await this.board.surface.boundingBox())!;

    await this.page.mouse.move(box.x + corner.x, box.y + corner.y);
    await this.page.mouse.down();

    await this.page.mouse.move(box.x + corner.x + 70, box.y + corner.y + 50, {
      steps: 10,
    });

    await this.page.mouse.up();

    await expect
      .poll(
        async () => (await this.board.storage.records()).main!.items[0]!.matrix,
      )
      .not.toEqual(original.matrix);

    const resized = (await this.board.storage.records()).main!.items[0]!;

    if (resized.kind !== "template")
      throw new Error("Expected resized template");

    expect(resized.template).toEqual(original.template);
    await this.board.undo();
    await this.board.storage.expectScene([original]);
    await this.board.redo();
    await this.board.storage.expectScene([resized]);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([resized]);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectManualRecommendationAndDrafts() {
    const panel = await this.figures();

    const preview = panel.getByRole("img", {
      name: "Предварительный вид заготовки",
      exact: true,
    });

    const place = panel.getByRole("button", {
      name: "Разместить на доске",
      exact: true,
    });

    await panel.getByLabel("От", { exact: true }).fill("-1000");
    await panel.getByLabel("До", { exact: true }).fill("1000");

    const effective = (await panel
      .getByLabel("Текущий шаг", { exact: true })
      .textContent())!.replace(/[^\d.e+-]/g, "");

    await panel
      .getByRole("radio", { name: "Шаг вручную", exact: true })
      .check();

    const step = panel.getByLabel("Шаг делений", { exact: true });

    await expect(step).toHaveValue(effective);

    const valid = await preview.innerHTML();

    await step.fill("0.001");
    await expect(place).toBeDisabled();
    await expect(preview).toBeVisible();
    expect(await preview.innerHTML()).toBe(valid);

    await expect(
      panel.getByText("Последний корректный вид", { exact: true }),
    ).toBeVisible();

    await panel.getByRole("button", { name: /^Применить шаг / }).click();
    await expect(place).toBeEnabled();

    await expect(
      panel.getByText("Последний корректный вид", { exact: true }),
    ).toBeHidden();

    const from = panel.getByLabel("От", { exact: true });

    await from.fill("-");
    await expect(from).toHaveValue("-");
    await expect(place).toBeDisabled();
    await expect(preview).toBeVisible();
    expect(await preview.innerHTML()).toBe(valid);
    await from.fill("");
    await expect(from).toHaveValue("");
    await expect(place).toBeDisabled();
    await from.fill("100");
    await expect(place).toBeDisabled();
    await expect(panel.getByRole("alert")).toContainText(/ноль/);
    await from.fill("-1000");
    await expect(place).toBeEnabled();
    await this.page.keyboard.press("Escape");
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectContextualHelp() {
    const panel = await this.figures();

    const help = panel.getByRole("button", {
      name: "О фигурах и заготовках",
      exact: true,
    });

    const tooltip = help.locator("..").getByRole("tooltip");

    await help.hover();
    await expect(tooltip).toBeVisible();
    await this.page.mouse.move(20, 450);
    await expect(tooltip).toBeHidden();
    await help.focus();
    await expect(tooltip).toBeVisible();
    await this.page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
    await expect(panel).toBeVisible();
    await help.click();
    await this.page.mouse.move(20, 450);
    await expect(tooltip).toBeVisible();
    await panel.getByLabel("От", { exact: true }).click();
    await expect(tooltip).toBeHidden();
    await this.page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectOutlineSlider() {
    const panel = await this.figures("Прямоугольник");

    const slider = panel.getByRole("slider", {
      name: "Толщина контура",
      exact: true,
    });

    await slider.fill("5.5");
    await slider.focus();
    await this.page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("6");

    await panel
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .click();

    await this.board.surface.click({ position: { x: 650, y: 430 } });
    await this.board.storage.expectStrokeCount(1);

    const item = (await this.board.storage.records()).main!.items[0]!;

    if (item.kind !== "template") throw new Error("Expected rectangle");

    expect(item.template.lineWidth).toBe(6);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([item]);
  }
}
