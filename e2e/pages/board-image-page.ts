import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { BoardPage } from "./board-page";
import type { TestImageTypes } from "../data/image-files";
import type { BoardTransformPage } from "./board-transform-page";

export class BoardImagePage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  async insert(file: TestImageTypes.File) {
    const chooser = this.page.waitForEvent("filechooser");

    await this.page
      .getByRole("button", { name: "Вставить изображение", exact: true })
      .click();

    await (await chooser).setFiles(file);
    await this.board.storage.expectSaved();
  }

  async expectImages(count: number) {
    await expect
      .poll(async () => {
        const doc = (await this.board.storage.records()).main;

        return doc?.items.filter((item) => item.kind === "image").length ?? 0;
      })
      .toBe(count);

    await this.board.storage.expectSaved();
  }

  private async firstImage() {
    const document = (await this.board.storage.records()).main!;
    const item = document.items.find((entry) => entry.kind === "image");

    if (!item || item.kind !== "image")
      throw new Error("Expected an inserted image");

    const asset = document.assets.find((entry) => entry.id === item.assetId);

    if (!asset) throw new Error("Image asset missing from portable document");

    return { document, item, asset };
  }

  async expectOrientedJpeg(file: TestImageTypes.File) {
    await this.insert(file);
    await this.expectImages(1);

    const original = await this.firstImage();

    expect(original.asset.width).toBe(160);
    expect(original.asset.height).toBe(240);
    expect(Buffer.from(original.asset.base64, "base64")).toEqual(file.buffer);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(original.document.items);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectCorruptImageImportPreservesCurrent(file: TestImageTypes.File) {
    await this.insert(file);
    await this.expectImages(1);

    const original = (await this.board.storage.records()).main!;
    const before = await this.board.storage.records();

    const candidate = {
      ...original,
      assets: original.assets.map((asset) => ({
        ...asset,
        base64: Buffer.from(asset.base64, "base64")
          .subarray(0, 33)
          .toString("base64"),
      })),
    };

    await this.board.storage.beginImport();

    const dialog = this.page.getByRole("dialog", {
      name: "Импорт доски",
      exact: true,
    });

    await dialog.locator("input[type=file]").setInputFiles({
      name: "corrupt-image.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(candidate)),
    });

    await expect(
      dialog.getByRole("button", { name: "Заменить доску", exact: true }),
    ).toBeEnabled();

    await dialog
      .getByRole("button", { name: "Заменить доску", exact: true })
      .click();

    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(await this.board.storage.records()).toEqual(before);
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
    await this.board.storage.closeDetails();
    await this.board.storage.expectScene(original.items);
  }

  async expectInsertionAndTransform(
    file: TestImageTypes.File,
    transform: BoardTransformPage,
  ) {
    await this.insert(file);
    await this.expectImages(1);

    const initial = await this.firstImage();

    expect(initial.asset.width).toBe(240);
    expect(initial.asset.height).toBe(160);
    expect(initial.asset.mime).toBe(file.mimeType);
    expect(Buffer.from(initial.asset.base64, "base64")).toEqual(file.buffer);

    const rgba = await this.page
      .locator("canvas[data-layer=completed]")
      .evaluate((canvas, matrix) => {
        const target = canvas as HTMLCanvasElement;
        const x = Math.round(matrix[0]! * 60 + matrix[2]! * 40 + matrix[4]!);
        const y = Math.round(matrix[1]! * 60 + matrix[3]! * 40 + matrix[5]!);

        return [...target.getContext("2d")!.getImageData(x, y, 1, 1).data];
      }, initial.item.matrix);

    expect(rgba[0]).toBeGreaterThan(150);
    expect(rgba[1]).toBeLessThan(120);
    expect(rgba[3]).toBe(255);
    await transform.numeric(150, 125, 30);

    const changed = await this.firstImage();

    expect(changed.asset).toEqual(initial.asset);
    expect(changed.item.matrix).not.toEqual(initial.item.matrix);
    await this.board.undo();
    await this.board.storage.expectScene(initial.document.items);
    await this.board.redo();
    await this.board.storage.expectScene(changed.document.items);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(changed.document.items);
    await this.board.storage.expectExportMatchesSaved();
  }

  private async actions() {
    const trigger = this.page.getByRole("button", {
      name: "Действия",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  async expectCropAndPortablePng(file: TestImageTypes.File) {
    await this.insert(file);
    await this.expectImages(1);
    await this.board.drawStroke();

    const original = (await this.board.storage.records()).main!;
    const image = await this.firstImage();
    const matrix = image.item.matrix;

    await this.board.selectRectangle(
      { x: matrix[4] - 10, y: matrix[5] - 10 },
      { x: matrix[4] + 120, y: matrix[5] + 170 },
    );

    await this.actions();

    await this.page
      .getByRole("button", { name: "Обрезать изображения", exact: true })
      .click();

    await this.board.storage.expectSaved();

    const cropped = await this.firstImage();

    expect(cropped.item.clip).toBeTruthy();
    expect(cropped.asset).toEqual(image.asset);

    expect(
      cropped.document.items.filter((item) => item.kind === "ink"),
    ).toEqual(original.items.filter((item) => item.kind === "ink"));

    await this.board.undo();
    await this.board.storage.expectScene(original.items);
    await this.board.redo();
    await this.board.storage.expectScene(cropped.document.items);

    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");
    await this.actions();

    await this.page
      .getByRole("button", { name: "Копировать изображение", exact: true })
      .click();

    await this.actions();

    const downloadButton = this.page.getByRole("button", {
      name: "Скачать PNG",
      exact: true,
    });

    await expect(downloadButton).toBeEnabled();

    const pending = this.page.waitForEvent("download");

    await downloadButton.click();

    const download = await pending;
    const path = await download.path();

    expect(path).toBeTruthy();

    const bytes = await readFile(path!);

    expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(bytes.readUInt32BE(16)).toBeGreaterThan(100);
    expect(bytes.readUInt32BE(20)).toBeGreaterThan(100);

    const pixels = await this.page.evaluate(async (base64) => {
      const data = Uint8Array.from(atob(base64), (entry) =>
        entry.charCodeAt(0),
      );

      const image = await createImageBitmap(
        new Blob([data], { type: "image/png" }),
      );

      const canvas = document.createElement("canvas");

      canvas.width = image.width;
      canvas.height = image.height;

      const ctx = canvas.getContext("2d")!;

      ctx.drawImage(image, 0, 0);
      image.close();

      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const counts = { transparent: 0, red: 0, blue: 0 };

      for (let i = 0; i < rgba.length; i += 4) {
        if (rgba[i + 3] === 0) counts.transparent++;

        if (rgba[i]! > 150 && rgba[i + 1]! < 120 && rgba[i + 3]! > 200)
          counts.red++;

        if (rgba[i + 2]! > 150 && rgba[i]! < 120 && rgba[i + 3]! > 200)
          counts.blue++;
      }

      return counts;
    }, bytes.toString("base64"));

    expect(pixels.transparent).toBeGreaterThan(100);
    expect(pixels.red).toBeGreaterThan(100);
    expect(pixels.blue).toBeGreaterThan(100);
  }

  async expectMixedCropRetainsPartialInk(file: TestImageTypes.File) {
    await this.insert(file);
    await this.expectImages(1);
    await this.board.drawStroke({ x: 400, y: 450 }, { x: 900, y: 450 });

    const original = (await this.board.storage.records()).main!;

    await this.board.selectRectangle({ x: 510, y: 360 }, { x: 640, y: 540 });
    await this.actions();

    await this.page
      .getByRole("button", { name: "Обрезать изображения", exact: true })
      .click();

    await this.board.storage.expectSaved();

    const cropped = (await this.board.storage.records()).main!;

    expect(cropped.items.filter((item) => item.kind === "ink")).toEqual(
      original.items.filter((item) => item.kind === "ink"),
    );

    await this.actions();

    await this.page
      .getByRole("button", { name: "Удалить", exact: true })
      .click();

    await expect
      .poll(
        async () =>
          (await this.board.storage.records()).main!.items.filter(
            (item) => item.kind === "image",
          ).length,
      )
      .toBe(0);

    const remaining = (await this.board.storage.records()).main!.items.filter(
      (item) => item.kind === "ink",
    );

    expect(
      remaining.length,
      "Ink outside the selection must remain",
    ).toBeGreaterThan(0);

    const alpha = await this.page
      .locator("canvas[data-layer=completed]")
      .evaluate((canvas) => {
        const target = canvas as HTMLCanvasElement;

        const data = target
          .getContext("2d")!
          .getImageData(440, 440, 420, 20).data;

        const at = (x: number) => data[((450 - 440) * 420 + x - 440) * 4 + 3];

        return [at(450), at(580), at(850)];
      });

    expect(alpha).toEqual([255, 0, 255]);
    await this.board.undo();
    await this.board.storage.expectScene(cropped.items);
    await this.board.undo();
    await this.board.storage.expectScene(original.items);
  }

  async payload(file: TestImageTypes.File, kind: "drop" | "paste") {
    const dataTransfer = await this.page.evaluateHandle(
      ({ name, mimeType, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (entry) =>
          entry.charCodeAt(0),
        );

        const transfer = new DataTransfer();

        transfer.items.add(new File([bytes], name, { type: mimeType }));

        return transfer;
      },
      {
        name: file.name,
        mimeType: file.mimeType,
        base64: file.buffer.toString("base64"),
      },
    );

    const bounds = (await this.board.surface.boundingBox())!;

    if (kind === "paste") {
      // dispatchEvent's generic Event initializer drops clipboardData. Construct the
      // actual ClipboardEvent so the native board listener receives the File payload.
      await this.board.surface.evaluate(
        (canvas, transfer) =>
          canvas.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: transfer,
              bubbles: true,
              cancelable: true,
            }),
          ),
        dataTransfer,
      );
    } else {
      await this.board.surface.dispatchEvent("drop", {
        dataTransfer,
        clientX: bounds.x + 300,
        clientY: bounds.y + 350,
      });
    }

    await dataTransfer.dispose();
  }

  async expectDropPasteAndInvalidFile(files: TestImageTypes.Files) {
    await this.payload(files.jpeg, "drop");
    await this.expectImages(1);
    await this.payload(files.png, "paste");
    await this.expectImages(2);

    const before = (await this.board.storage.records()).main!;

    await this.board.storage.beginImport();
    await this.payload(files.png, "paste");

    await this.page
      .getByRole("button", { name: "Отмена", exact: true })
      .click();

    await this.board.storage.closeDetails();
    await this.expectImages(2);

    expect((await this.board.storage.records()).main!.items).toEqual(
      before.items,
    );

    await this.insert(files.invalid);

    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: /PNG|JPEG|SVG|формат/ })
        .first(),
    ).toBeVisible();

    expect((await this.board.storage.records()).main!.items).toEqual(
      before.items,
    );

    expect((await this.board.storage.records()).main!.assets).toEqual(
      before.assets,
    );
  }

  async copyAll() {
    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");
    await this.page.keyboard.press("Control+c");
  }

  async pasteInternal() {
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
  }
}
