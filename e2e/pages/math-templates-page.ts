import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { MathRasterPage } from "./math-raster-page";
import type { BoardPage } from "./board-page";
import type { BoardLibraryPage } from "./board-library-page";
import type { TestBoardTypes } from "../data/board.types";

export class MathTemplatesPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly legacy: TestBoardTypes.StoredDocument,
  ) {}

  private panel() {
    return this.page.getByRole("dialog", {
      name: "Фигуры и заготовки",
      exact: true,
    });
  }

  private preview() {
    return this.panel().getByRole("img", {
      name: "Предварительный вид заготовки",
      exact: true,
    });
  }

  private async open(name: string) {
    await this.page
      .getByRole("button", { name: "Фигуры и заготовки", exact: true })
      .click();

    await this.panel().getByRole("button", { name, exact: true }).click();

    return this.panel();
  }

  private async range(min: number, max: number) {
    const panel = this.panel();

    await panel.getByLabel("От", { exact: true }).fill(String(min));
    await panel.getByLabel("До", { exact: true }).fill(String(max));

    await panel
      .getByRole("radio", { name: "Шаг вручную", exact: true })
      .check();

    await panel.getByLabel("Шаг делений", { exact: true }).fill("1");

    await expect(
      panel.getByRole("button", { name: "Разместить на доске", exact: true }),
    ).toBeEnabled();
  }

  private async place() {
    await this.panel()
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .click();

    await this.board.surface.click({ position: { x: 600, y: 440 } });
    await this.board.storage.expectSaved();
  }

  async expectRequiredRanges() {
    let count = 0;

    for (const name of ["Числовая прямая", "Оси XY"]) {
      let width = 0;

      for (const [min, max] of [
        [0, 15],
        [0, 100],
        [-100, 100],
      ]) {
        await this.open(name);
        await this.range(min!, max!);
        await this.place();
        await this.board.storage.expectStrokeCount(++count);

        const item = (await this.board.storage.records()).main!.items.at(-1)!;

        if (item.kind !== "template")
          throw new Error("Expected a vector math template");

        expect(item.generatorVersion).toBe(2);
        expect(item.template.min).toBe(min);
        expect(item.template.max).toBe(max);
        expect(item.template.step).toBe(1);
        expect(item.template.width).toBeGreaterThan(width);
        width = item.template.width;
        expect(item.matrix[0]).toBeCloseTo(1, 5);
        expect(item.matrix[3]).toBeCloseTo(1, 5);

        if (name === "Оси XY")
          expect(item.template.width).toBe(item.template.height);
      }
    }

    const saved = (await this.board.storage.records()).main!.items;

    await this.board.undo();
    await this.board.storage.expectStrokeCount(count - 1);
    await this.board.redo();
    await this.board.storage.expectScene(saved);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(saved);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectPreviewNavigation() {
    await this.open("Оси XY");
    await this.range(-100, 100);

    const preview = this.preview();
    const closeup = await preview.getAttribute("viewBox");
    const before = (await this.board.storage.records()).main!;

    await this.panel()
      .getByRole("button", { name: "Целиком", exact: true })
      .click();

    await expect(preview).not.toHaveAttribute("viewBox", closeup!);

    const whole = await preview.getAttribute("viewBox");

    await this.panel()
      .getByRole("button", { name: "Крупно", exact: true })
      .click();

    await expect(preview).toHaveAttribute("viewBox", closeup!);

    const box = (await preview.boundingBox())!;

    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();

    await this.page.mouse.move(
      box.x + box.width / 2 + 45,
      box.y + box.height / 2 + 25,
      { steps: 8 },
    );

    await this.page.mouse.up();
    await expect(preview).not.toHaveAttribute("viewBox", closeup!);

    const dragged = await preview.getAttribute("viewBox");

    await this.panel()
      .getByRole("region", {
        name: "Предпросмотр математической фигуры",
        exact: true,
      })
      .focus();

    await this.page.keyboard.press("ArrowRight");
    await expect(preview).not.toHaveAttribute("viewBox", dragged!);
    expect(await preview.getAttribute("viewBox")).not.toBe(whole);
    await this.page.keyboard.press("Escape");
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();

    expect((await this.board.storage.records()).main!.viewport).toEqual(
      before.viewport,
    );
  }

  async expectCircleNotationAndPng() {
    const panel = await this.open("Тригонометрическая окружность");
    const angles = panel.getByRole("checkbox", { name: "Углы", exact: true });

    const coordinates = panel.getByRole("checkbox", {
      name: "Координаты",
      exact: true,
    });

    await expect(angles).toBeChecked();
    await expect(coordinates).toBeChecked();
    await coordinates.uncheck();
    await expect(this.preview()).toContainText("π/6");
    await angles.uncheck();
    await expect(this.preview()).not.toContainText("π/6");
    await coordinates.check();
    await angles.check();

    const raster = new MathRasterPage(this.page);
    const previewSource = await raster.capturePreview();

    await this.place();
    await this.board.storage.expectStrokeCount(1);

    const item = (await this.board.storage.records()).main!.items[0]!;

    if (item.kind !== "template") throw new Error("Expected a vector circle");

    expect(item.generatorVersion).toBe(2);
    expect(item.template.numbers).toBe(true);
    expect(item.template.labels).toBe(true);

    await this.page
      .getByRole("button", { name: "Действия", exact: true })
      .click();

    const pending = this.page.waitForEvent("download");

    await this.page
      .getByRole("button", { name: "Скачать PNG", exact: true })
      .click();

    const file = await pending;
    const path = await file.path();

    expect(path).toBeTruthy();

    const bytes = await readFile(path!);

    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(300);
    expect(bytes.readUInt32BE(20)).toBeGreaterThan(300);
    await raster.expectPngAgreement(bytes, previewSource, item.template);
    await this.page.keyboard.press("Escape");
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([item]);
  }

  async expectMixedVersions(library: BoardLibraryPage) {
    await this.board.storage.importDocument(this.legacy);
    await this.board.storage.expectScene(this.legacy.items);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(this.legacy.items);
    await this.open("Оси XY");
    await this.place();
    await this.board.storage.expectStrokeCount(4);

    const original = (await this.board.storage.records()).main!.items;

    expect(original.slice(0, 3)).toEqual(this.legacy.items);
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");
    await this.page.keyboard.press("Control+x");
    await this.board.storage.expectStrokeCount(0);
    await library.create("Версии математических фигур");
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await this.board.storage.expectStrokeCount(4);

    const pasted = (await this.board.storage.records()).main!.items;

    expect(
      pasted.map((item) =>
        item.kind === "template" ? item.generatorVersion : null,
      ),
    ).toEqual([1, 1, 1, 2]);

    expect(
      pasted.map((item) => (item.kind === "template" ? item.template : null)),
    ).toEqual(
      original.map((item) => (item.kind === "template" ? item.template : null)),
    );

    expect(pasted[2]!.clip).toEqual(original[2]!.clip);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(pasted);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectTouchLayouts() {
    for (const size of [
      { width: 390, height: 844 },
      { width: 834, height: 1112 },
      { width: 1194, height: 834 },
    ]) {
      await this.page.setViewportSize(size);

      const panel = await this.open("Тригонометрическая окружность");
      const dock = await this.page.locator("[data-editor-dock]").boundingBox();
      const surface = await this.board.surface.boundingBox();
      const bounds = (await panel.boundingBox())!;

      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width + 1);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height + 1);

      expect(
        await panel.evaluate(
          (element) => element.scrollWidth - element.clientWidth,
        ),
      ).toBeLessThanOrEqual(1);

      for (const name of ["Крупно", "Целиком"]) {
        const control = panel.getByRole("button", { name, exact: true });

        await control.scrollIntoViewIfNeeded();

        const target = (await control.boundingBox())!;

        expect(target.width).toBeGreaterThanOrEqual(44);
        expect(target.height).toBeGreaterThanOrEqual(44);
      }

      await panel.getByRole("button", { name: "Целиком", exact: true }).click();
      await expect(this.preview()).toBeVisible();

      const place = panel.getByRole("button", {
        name: "Разместить на доске",
        exact: true,
      });

      await place.scrollIntoViewIfNeeded();
      await expect(place).toBeInViewport();

      expect(
        await this.page.locator("[data-editor-dock]").boundingBox(),
      ).toEqual(dock);

      expect(await this.board.surface.boundingBox()).toEqual(surface);

      await panel
        .getByRole("button", { name: "Закрыть заготовки", exact: true })
        .click();
    }

    await this.board.storage.expectStrokeCount(0);
  }

  async expectTouchPreviewPan() {
    await this.page.setViewportSize({ width: 390, height: 844 });
    await this.open("Оси XY");
    await this.range(-100, 100);

    const preview = this.preview();

    await preview.scrollIntoViewIfNeeded();

    const before = (await this.board.storage.records()).main!.viewport;
    const viewBox = await preview.getAttribute("viewBox");

    await preview.evaluate((element) => {
      const box = element.getBoundingClientRect();

      const x = box.x + box.width / 2,
        y = box.y + box.height / 2;

      for (const [type, dx, dy] of [
        ["pointerdown", 0, 0],
        ["pointermove", 45, 20],
        ["pointerup", 45, 20],
      ] as const)
        element.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 91,
            pointerType: "touch",
            isPrimary: true,
            clientX: x + dx,
            clientY: y + dy,
            button: type === "pointermove" ? -1 : 0,
            buttons: type === "pointerup" ? 0 : 1,
          }),
        );
    });

    await expect(preview).not.toHaveAttribute("viewBox", viewBox!);

    await this.panel()
      .getByRole("button", { name: "Закрыть заготовки", exact: true })
      .click();

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
    expect((await this.board.storage.records()).main!.viewport).toEqual(before);
  }
}
