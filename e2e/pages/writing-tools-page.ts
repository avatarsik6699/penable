import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardImagePage } from "./board-image-page";
import type { TestImageTypes } from "../data/image-files";

export class WritingToolsPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async settings() {
    const trigger = this.page.getByRole("button", {
      name: "Перо",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  private async choose(name: string) {
    await this.settings();
    await this.page.getByRole("radio", { name, exact: true }).check();
  }

  private async color(name: string) {
    await this.page
      .getByRole("button", { name: `Цвет: ${name}`, exact: true })
      .click();
  }

  private async stroke(y: number, reverse = false) {
    const bounds = await this.board.surface.boundingBox();

    if (!bounds) throw new Error("Missing board surface");

    await this.page.mouse.move(bounds.x + 200, bounds.y + y);
    await this.page.mouse.down();
    await this.page.mouse.move(bounds.x + 500, bounds.y + y, { steps: 30 });

    if (reverse)
      await this.page.mouse.move(bounds.x + 200, bounds.y + y, { steps: 30 });

    await this.page.mouse.up();
    await this.board.storage.expectSaved();
  }

  private async pixel(x: number, y: number) {
    return this.page.locator("canvas[data-layer=completed]").evaluate(
      (element, point) => {
        const canvas = element as HTMLCanvasElement;
        const bounds = canvas.getBoundingClientRect();

        const sample = Object.assign(document.createElement("canvas"), {
          width: 1,
          height: 1,
        });

        const context = sample.getContext("2d", { willReadFrequently: true })!;

        context.drawImage(
          canvas,
          Math.round((point.x * canvas.width) / bounds.width),
          Math.round((point.y * canvas.height) / bounds.height),
          1,
          1,
          0,
          0,
          1,
          1,
        );

        return [...context.getImageData(0, 0, 1, 1).data];
      },
      { x, y },
    );
  }

  async expectPaletteAndInstrumentPersistence() {
    const dock = this.page.locator("[data-editor-dock]");
    const original = await dock.boundingBox();

    await this.choose("Ручка");
    await this.color("Синий");
    await this.stroke(300);

    const blue = await this.pixel(350, 300);

    expect(blue[2]).toBeGreaterThan(blue[0]!);
    expect(blue[3]).toBe(255);

    await this.choose("Маркер");
    await this.stroke(400);

    const marker = await this.pixel(350, 400);

    expect(marker[3]).toBeGreaterThan(0);
    expect(marker[3]).toBeLessThan(255);
    expect(await dock.boundingBox()).toEqual(original);

    await this.choose("Ручка");
    await this.stroke(500);
    expect(await this.pixel(350, 500)).toEqual(blue);

    const before = await this.board.storage.sceneFingerprint();

    await this.board.reopenSavedBoard();
    await this.board.storage.expectFingerprint(before);
    expect(await this.pixel(350, 300)).toEqual(blue);
    expect(await this.pixel(350, 400)).toEqual(marker);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectUniformHighlighterAndHistory() {
    await this.choose("Маркер");
    await this.stroke(400, true);

    const once = await this.pixel(350, 400);

    expect(once[3]).toBeGreaterThanOrEqual(75);
    expect(once[3]).toBeLessThanOrEqual(78);

    await this.stroke(400);

    const twice = await this.pixel(350, 400);

    expect(twice[3]).toBeGreaterThan(once[3]!);
    expect(twice[3]).toBeLessThan(145);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(1);
    expect(await this.pixel(350, 400)).toEqual(once);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(2);
    expect(await this.pixel(350, 400)).toEqual(twice);
    await this.board.reopenSavedBoard();
    expect(await this.pixel(350, 400)).toEqual(twice);
  }

  async expectClippedTranslucencyPreservesLayerOrder() {
    await this.choose("Маркер");
    await this.stroke(400);
    await this.choose("Ручка");
    await this.color("Синий");
    await this.stroke(400);

    const raster = async () =>
      this.page
        .locator("canvas[data-layer=completed]")
        .evaluate((element) => (element as HTMLCanvasElement).toDataURL());

    const before = await raster();

    await this.board.selectRectangle({ x: 260, y: 380 }, { x: 340, y: 420 });
    await this.board.moveSelection({ x: 300, y: 395 }, { x: 340, y: 425 });
    await this.board.storage.expectSaved();
    await this.board.moveSelection({ x: 340, y: 425 }, { x: 300, y: 395 });
    await this.board.storage.expectSaved();
    await expect.poll(raster).toBe(before);
    await this.board.reopenSavedBoard();
    await expect.poll(raster).toBe(before);
  }

  async expectMarkerDoesNotTintImages(
    image: BoardImagePage,
    file: TestImageTypes.File,
  ) {
    await this.choose("Маркер");
    await this.stroke(400);
    await image.insert(file);
    await this.board.storage.expectStrokeCount(2);
    await this.board.reopenSavedBoard();

    const item = (await this.board.storage.records()).main!.items.find(
      (entry) => entry.kind === "image",
    );

    if (!item || item.kind !== "image")
      throw new Error("Missing inserted opaque PNG");

    const matrix = item.matrix;

    await expect
      .poll(() =>
        this.pixel(
          matrix[0] * 60 + matrix[2] * 40 + matrix[4],
          matrix[1] * 60 + matrix[3] * 40 + matrix[5],
        ),
      )
      .toEqual([229, 57, 53, 255]);
  }

  async expectPressureAffectsGeometryAndSurvivesReload() {
    await this.choose("Перо с нажимом");

    await this.page
      .getByRole("slider", { name: "Толщина", exact: true })
      .fill("10");

    await this.page.keyboard.press("Escape");

    await this.board.surface.evaluate(async (element) => {
      const rect = element.getBoundingClientRect();

      for (const [row, pressure] of [
        [300, 0.1],
        [400, 0.9],
      ]) {
        for (let index = 0; index <= 40; index++) {
          element.dispatchEvent(
            new PointerEvent(index === 0 ? "pointerdown" : "pointermove", {
              bubbles: true,
              pointerType: "pen",
              pointerId: 23,
              isPrimary: true,
              button: index === 0 ? 0 : -1,
              buttons: 1,
              clientX: rect.left + 200 + index * 7.5,
              clientY: rect.top + row!,
              pressure,
            }),
          );
        }

        element.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            pointerType: "pen",
            pointerId: 23,
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: rect.left + 500,
            clientY: rect.top + row!,
            pressure,
          }),
        );
      }

      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
    });

    await this.board.storage.expectStrokeCount(2);

    const thickness = async () =>
      this.page.locator("canvas[data-layer=completed]").evaluate((element) => {
        const canvas = element as HTMLCanvasElement;
        const bounds = canvas.getBoundingClientRect();

        const sample = Object.assign(document.createElement("canvas"), {
          width: canvas.width,
          height: canvas.height,
        });

        const context = sample.getContext("2d", { willReadFrequently: true })!;

        context.drawImage(canvas, 0, 0);

        const ratioX = canvas.width / bounds.width;
        const ratioY = canvas.height / bounds.height;

        return [300, 400].map((y) => {
          const data = context.getImageData(
            Math.round(350 * ratioX),
            Math.round((y - 15) * ratioY),
            1,
            Math.round(30 * ratioY),
          ).data;

          return [...data].filter(
            (value, index) => index % 4 === 3 && value > 128,
          ).length;
        });
      });

    const widths = await thickness();

    expect(widths[0]).toBeGreaterThan(0);
    expect(widths[1]).toBeGreaterThan(widths[0]!);
    await this.board.reopenSavedBoard();
    expect(await thickness()).toEqual(widths);
  }

  async expectOpaqueColorPreviewMatchesCommit() {
    await this.choose("Ручка");
    await this.color("Синий");
    await this.stroke(350);
    await this.choose("Ручка");
    await this.color("Красный");
    await this.stroke(450);
    await this.board.selectRectangle({ x: 260, y: 330 }, { x: 340, y: 370 });

    const box = (await this.board.surface.boundingBox())!;

    await this.page.mouse.move(box.x + 300, box.y + 350);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 400, box.y + 450, { steps: 12 });

    const composite = () =>
      this.page.evaluate(() => {
        const sample = Object.assign(document.createElement("canvas"), {
          width: 1,
          height: 1,
        });

        const context = sample.getContext("2d", { willReadFrequently: true })!;

        for (const element of document.querySelectorAll("canvas[data-layer]")) {
          const canvas = element as HTMLCanvasElement;
          const bounds = canvas.getBoundingClientRect();

          context.drawImage(
            canvas,
            Math.round((400 * canvas.width) / bounds.width),
            Math.round((450 * canvas.height) / bounds.height),
            1,
            1,
            0,
            0,
            1,
            1,
          );
        }

        return [...context.getImageData(0, 0, 1, 1).data];
      });

    await expect.poll(composite).toEqual([217, 45, 32, 255]);
    await this.page.mouse.up();
    await this.board.storage.expectSaved();
    await expect.poll(composite).toEqual([217, 45, 32, 255]);
    await this.board.reopenSavedBoard();
    await expect.poll(composite).toEqual([217, 45, 32, 255]);
  }
}
