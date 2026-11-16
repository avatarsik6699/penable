import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type {
  ImageInsertionFile,
  ImageWorkerGateState,
} from "../data/image-insertion.types";

type WorkerGate = {
  arm: () => Promise<void>;
  release: () => Promise<boolean>;
  state: () => Promise<ImageWorkerGateState>;
};

type InsertPath = "paste" | "menu" | "file";

export class ImageInsertionPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly image: ImageInsertionFile,
    private readonly worker: WorkerGate,
    private readonly focusReturn: (
      whileOutsideFocused?: () => Promise<void>,
    ) => Promise<void>,
  ) {}

  private async images() {
    const document = (await this.board.storage.records()).main;

    return document?.items.filter((item) => item.kind === "image") ?? [];
  }

  private async imageBytes() {
    const document = (await this.board.storage.records()).main;

    const image = document?.items
      .filter((item) => item.kind === "image")
      .at(-1);

    if (!document || !image || image.kind !== "image")
      throw new Error("Expected a committed image item");

    const asset = document.assets.find((entry) => entry.id === image.assetId);

    if (!asset) throw new Error("Committed image asset is missing");

    return asset.base64;
  }

  private async makeInkAndReturnFocus() {
    await this.board.drawStroke({ x: 90, y: 260 }, { x: 340, y: 305 });
    await this.focusReturn();
  }

  private async noSelection() {
    await expect(
      this.page.locator('[data-testid="selection-handles"]'),
    ).toHaveAttribute("d", "");
  }

  private async putClipboardImage() {
    return this.page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (character) =>
        character.charCodeAt(0),
      );

      const item = new ClipboardItem({
        "image/png": new Blob([bytes], { type: "image/png" }),
      });

      await navigator.clipboard.write([item]);

      const [read] = await navigator.clipboard.read();

      if (!read) throw new Error("Clipboard did not retain the test PNG");

      const blob = await read.getType("image/png");

      if (blob.size <= 128 * 1024)
        throw new Error("Normalized clipboard PNG must exceed 128 KiB");

      const normalized = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = () => resolve(String(reader.result).split(",")[1]!);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });

      return normalized;
    }, this.image.base64);
  }

  private async chooseFile() {
    const chooser = this.page.waitForEvent("filechooser");

    await this.page
      .getByRole("button", { name: "Вставить изображение", exact: true })
      .click();

    await (
      await chooser
    ).setFiles({
      name: this.image.name,
      mimeType: this.image.mimeType,
      buffer: Buffer.from(this.image.base64, "base64"),
    });
  }

  private async perform(path: InsertPath) {
    if (path === "paste") {
      await this.board.surface.focus();
      await this.page.keyboard.press("Control+v");
    } else if (path === "menu") {
      await this.page
        .getByRole("button", { name: "Выделение", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Действия", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Вставить", exact: true })
        .click();
    } else await this.chooseFile();
  }

  private async expectActualValidation(before: ImageWorkerGateState) {
    await expect
      .poll(async () => (await this.worker.state()).terminalReplies)
      .toBeGreaterThan(before.terminalReplies);

    const after = await this.worker.state();

    expect(after.validateStarts).toBeGreaterThan(before.validateStarts);
    expect(after.validateFinishes).toBeGreaterThan(before.validateFinishes);
    expect(after.acknowledgements).toBeGreaterThan(before.acknowledgements);
    expect(after.jobIds.at(-1)).toBeGreaterThan(before.jobIds.at(-1) ?? 0);
  }

  private async expectCommitted(expected: string, expectedCount = 1) {
    await expect
      .poll(async () => (await this.images()).length)
      .toBe(expectedCount);

    await this.board.storage.expectSaved();

    const base64 = await this.imageBytes();

    expect(base64).toBe(expected);

    await expect(
      this.page.locator('[data-testid="selection-handles"]'),
    ).not.toHaveAttribute("d", "");
  }

  private raster() {
    return this.page
      .locator("canvas[data-layer=completed]")
      .evaluate((canvas) => (canvas as HTMLCanvasElement).toDataURL());
  }

  async expectFiveInsertionsFrom(path: InsertPath) {
    await this.makeInkAndReturnFocus();

    if (path === "menu")
      await this.page
        .getByRole("button", { name: "Выделение", exact: true })
        .click();

    const expectedInk = (await this.board.storage.records()).main!.items.filter(
      (item) => item.kind === "ink",
    );

    const inkRaster = await this.raster();

    for (let iteration = 0; iteration < 5; iteration++) {
      await this.noSelection();

      const before = await this.worker.state();

      const expected =
        path === "file" ? this.image.base64 : await this.putClipboardImage();

      await this.perform(path);
      await this.expectActualValidation(before);
      await this.expectCommitted(expected, iteration + 1);

      const current = (await this.board.storage.records()).main!;

      expect(current.items.filter((item) => item.kind === "ink")).toEqual(
        expectedInk,
      );

      expect(
        current.items.filter((item) => item.kind === "image"),
      ).toHaveLength(iteration + 1);

      if (iteration < 4) {
        await this.board.undo();

        await expect
          .poll(async () => (await this.images()).length)
          .toBe(iteration);

        await this.board.redo();

        await expect
          .poll(async () => (await this.images()).length)
          .toBe(iteration + 1);

        await this.board.storage.expectSaved();
        await this.page.keyboard.press("Escape");
        await this.noSelection();
      }
    }

    const saved = (await this.board.storage.records()).main!.items;
    const workerIds = (await this.worker.state()).validationWorkerIds;

    expect(workerIds).toHaveLength(5);
    expect(new Set(workerIds).size).toBe(1);

    await this.board.undo();
    await expect.poll(async () => (await this.images()).length).toBe(4);
    await this.board.redo();
    await this.board.storage.expectScene(saved);
    await expect.poll(() => this.raster()).not.toBe(inkRaster);

    const savedRaster = await this.raster();

    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(saved);
    await this.board.storage.expectSaved();
    await expect.poll(() => this.raster()).toBe(savedRaster);
  }

  async expectEmptyBoardInsertion() {
    expect((await this.board.storage.records()).main!.items).toHaveLength(0);
    await this.noSelection();

    const before = await this.worker.state();

    await this.chooseFile();
    await this.expectActualValidation(before);
    await this.expectCommitted(this.image.base64);
  }

  async expectDropKeepsSourceBytes() {
    await this.makeInkAndReturnFocus();

    const before = await this.worker.state();
    const rect = await this.board.surface.boundingBox();

    if (!rect) throw new Error("Board canvas is missing");

    await this.board.surface.evaluate((element, file) => {
      const bytes = Uint8Array.from(atob(file.base64), (character) =>
        character.charCodeAt(0),
      );

      const data = new DataTransfer();

      data.items.add(new File([bytes], file.name, { type: file.mimeType }));

      const target = element as HTMLCanvasElement;
      const center = target.getBoundingClientRect();

      target.dispatchEvent(
        new DragEvent("dragover", {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
          clientX: center.left + center.width / 2,
          clientY: center.top + center.height / 2,
        }),
      );

      target.dispatchEvent(
        new DragEvent("drop", {
          bubbles: true,
          cancelable: true,
          dataTransfer: data,
          clientX: center.left + center.width / 2,
          clientY: center.top + center.height / 2,
        }),
      );
    }, this.image);

    await this.expectActualValidation(before);
    await this.expectCommitted(this.image.base64);
  }

  async expectPointerNoiseDoesNotCancelHeldValidation() {
    await this.makeInkAndReturnFocus();

    const before = await this.worker.state();
    const normalized = await this.putClipboardImage();

    await this.worker.arm();
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await expect.poll(async () => (await this.worker.state()).held).toBe(true);

    const rect = await this.board.surface.boundingBox();

    if (!rect) throw new Error("Board canvas is missing");

    await this.page.mouse.move(rect.x + rect.width + 40, rect.y - 20);

    await this.board.surface.evaluate((element) => {
      const rect = element.getBoundingClientRect();

      element.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerType: "pen",
          pointerId: 9044,
          isPrimary: true,
          button: -1,
          buttons: 0,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
        }),
      );
    });

    await this.page.evaluate(() => {
      document.body.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          pointerType: "mouse",
          pointerId: 9045,
          isPrimary: true,
          button: 0,
          buttons: 0,
        }),
      );
    });

    expect((await this.worker.state()).held).toBe(true);
    expect(await this.images()).toHaveLength(0);
    expect((await this.board.storage.records()).main!.items).toHaveLength(1);
    expect(await this.worker.release()).toBe(true);
    await this.expectCommitted(normalized);
    await this.expectActualValidation(before);
  }

  async expectBlurAndHiddenKeepHeldValidation() {
    await this.makeInkAndReturnFocus();

    const normalized = await this.putClipboardImage();

    await this.worker.arm();
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await expect.poll(async () => (await this.worker.state()).held).toBe(true);

    await this.focusReturn(async () => {
      await this.page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          value: "hidden",
        });

        window.dispatchEvent(new Event("blur"));
        document.dispatchEvent(new Event("visibilitychange"));
      });
    });

    await this.page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        value: "visible",
      });

      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect((await this.worker.state()).held).toBe(true);
    expect(await this.images()).toHaveLength(0);
    expect(await this.worker.release()).toBe(true);
    await this.expectCommitted(normalized);
  }

  async expectStaleReleaseThenRetry() {
    await this.makeInkAndReturnFocus();

    const expectedInk = (await this.board.storage.records()).main!.items;

    const normalized = await this.putClipboardImage();

    await this.worker.arm();
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await expect.poll(async () => (await this.worker.state()).held).toBe(true);

    await this.page.keyboard.press("Escape");
    await expect.poll(async () => (await this.worker.state()).held).toBe(true);
    expect(await this.worker.release()).toBe(true);
    await expect.poll(async () => (await this.images()).length).toBe(0);

    expect((await this.board.storage.records()).main!.items).toEqual(
      expectedInk,
    );

    const beforeRetry = await this.worker.state();

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await this.expectActualValidation(beforeRetry);
    await this.expectCommitted(normalized);
  }
}
