import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardLibraryPage } from "./board-library-page";
import type { BoardImagePage } from "./board-image-page";
import type { TestImageTypes } from "../data/image-files";

const fragmentType = "web application/x-penable-fragment+json";

export class BoardClipboardPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async all() {
    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");

    await expect(
      this.page.getByTestId("selection-handles"),
    ).not.toHaveAttribute("d", "");
  }

  private async copy(cut = false) {
    await this.all();
    await this.page.keyboard.press(cut ? "Control+x" : "Control+c");

    await expect(
      this.page
        .getByText(
          cut
            ? "Фрагмент вырезан в системный буфер."
            : "Фрагмент скопирован в системный буфер.",
          { exact: true },
        )
        .first(),
    ).toBeVisible();

    const types = await this.page.evaluate(async () =>
      (await navigator.clipboard.read()).flatMap((item) => [...item.types]),
    );

    expect(types).toContain(fragmentType);
    expect(types).toContain("image/png");
  }

  private async paste() {
    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
  }

  private async fault(
    mode: "none" | "read-denied" | "write-denied" | "unavailable",
  ) {
    await this.page.evaluate((value) => {
      (window as unknown as { __clipboardFault18: string }).__clipboardFault18 =
        value;
    }, mode);
  }

  async expectMixedClipboardAcrossBoards(
    library: BoardLibraryPage,
    image: BoardImagePage,
    file: TestImageTypes.File,
  ) {
    await image.insert(file);
    await image.expectImages(1);
    await this.board.drawStroke({ x: 300, y: 300 }, { x: 420, y: 350 });
    await this.board.storage.expectStrokeCount(2);

    const original = (await this.board.storage.records()).main!;

    await this.copy();
    await library.create("Из буфера");
    await this.paste();
    await this.board.storage.expectStrokeCount(2);

    const copied = (await this.board.storage.records()).main!;

    expect(copied.items.map((item) => item.kind)).toEqual(
      original.items.map((item) => item.kind),
    );

    expect(copied.assets).toHaveLength(1);
    expect(copied.assets[0]!.base64).toBe(original.assets[0]!.base64);

    const sourceInk = original.items.find((item) => item.kind === "ink")!;
    const copiedInk = copied.items.find((item) => item.kind === "ink")!;

    if (sourceInk.kind !== "ink" || copiedInk.kind !== "ink")
      throw new Error("Ink fixture missing");

    expect(copiedInk.points).toEqual(sourceInk.points);
    expect(copiedInk.stabilization).toEqual(sourceInk.stabilization);
    await this.board.reopenSavedBoard();
    await this.paste();
    await this.board.storage.expectStrokeCount(4);
    expect((await this.board.storage.records()).main!.assets).toHaveLength(1);
    await library.switchTo("Моя доска");
    await this.board.storage.expectScene(original.items);
  }

  async expectCutAndPasteUseOrdinaryHistory(library: BoardLibraryPage) {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.copy(true);
    await this.board.storage.expectStrokeCount(0);
    await this.board.undo();
    await this.board.storage.expectScene(original);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(0);
    await library.create("Вставка");
    await this.paste();
    await this.board.storage.expectStrokeCount(1);

    expect((await this.board.storage.records()).main!.items[0]!.kind).toBe(
      "ink",
    );

    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(1);
    await library.switchTo("Моя доска");
    await this.board.storage.expectStrokeCount(0);
  }

  async expectNewExternalContentReplacesOldFragment(
    image: BoardImagePage,
    file: TestImageTypes.File,
  ) {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);
    await this.copy();

    await this.page.evaluate(() =>
      navigator.clipboard.writeText("External unsupported plain text"),
    );

    await this.paste();

    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: /В буфере нет фрагмента Penable, PNG или JPEG/ })
        .first(),
    ).toBeVisible();

    await this.board.storage.expectStrokeCount(1);
    await image.payload(file, "paste");
    await image.expectImages(1);
    await this.board.storage.expectStrokeCount(2);
  }

  async expectCorruptOwnFormatDoesNotPastePng(file: TestImageTypes.File) {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.page.evaluate(
      async ({ type, base64 }) => {
        const bytes = Uint8Array.from(atob(base64), (entry) =>
          entry.charCodeAt(0),
        );

        await navigator.clipboard.write([
          new ClipboardItem({
            [type]: new Blob(
              [
                JSON.stringify({
                  format: "penable-fragment",
                  schemaVersion: 999,
                }),
              ],
              { type: "application/x-penable-fragment+json" },
            ),
            "image/png": new Blob([bytes], { type: "image/png" }),
          }),
        ]);
      },
      { type: fragmentType, base64: file.buffer.toString("base64") },
    );

    await this.paste();

    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: /Неподдерживаемый формат фрагмента Penable/ })
        .first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original);
  }

  async expectDeniedCutPreservesSource() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.all();
    await this.fault("write-denied");
    await this.page.keyboard.press("Control+x");

    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: /Не удалось записать редактируемый фрагмент/ })
        .first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original);
    await this.fault("unavailable");
    await this.page.keyboard.press("Control+x");

    await expect(
      this.page.getByText(/Запись редактируемого фрагмента недоступна/).first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original);
  }

  async expectDeniedReadDoesNotFlattenOwnFragment() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);
    await this.copy();

    const original = (await this.board.storage.records()).main!.items;

    await this.fault("read-denied");
    await this.paste();

    await expect(
      this.page
        .getByRole("status")
        .filter({ hasText: /Нет доступа к системному буферу/ })
        .first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original);
  }

  async expectTruncatedClipboardAssetPreservesDocument(
    image: BoardImagePage,
    file: TestImageTypes.File,
  ) {
    await image.insert(file);
    await image.expectImages(1);
    await this.copy();

    const original = (await this.board.storage.records()).main!;

    await this.page.evaluate(async (type) => {
      const item = (await navigator.clipboard.read()).find((entry) =>
        entry.types.includes(type),
      )!;

      const payload = JSON.parse(await (await item.getType(type)).text()) as {
        document: { assets: Array<{ base64: string }> };
      };

      for (const asset of payload.document.assets)
        asset.base64 = btoa(atob(asset.base64).slice(0, 33));

      await navigator.clipboard.write([
        new ClipboardItem({
          [type]: new Blob([JSON.stringify(payload)], {
            type: "application/x-penable-fragment+json",
          }),
          "image/png": await item.getType("image/png"),
        }),
      ]);
    }, fragmentType);

    await this.paste();

    await expect(
      this.page
        .getByText(/Не удалось декодировать изображение фрагмента/)
        .first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original.items);

    expect((await this.board.storage.records()).main!.assets).toEqual(
      original.assets,
    );

    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(original.items);
  }

  async expectEventFallbackHonorsAdvertisedFormat(file: TestImageTypes.File) {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.fault("unavailable");

    const dispatch = async (own: boolean) => {
      await this.board.surface.evaluate(
        (canvas, data) => {
          const transfer = new DataTransfer();

          const bytes = Uint8Array.from(atob(data.base64), (entry) =>
            entry.charCodeAt(0),
          );

          transfer.items.add(
            new File([bytes], "external.png", { type: "image/png" }),
          );

          if (data.own)
            transfer.setData(
              "application/x-penable-fragment+json",
              "advertised editable data",
            );

          canvas.dispatchEvent(
            new ClipboardEvent("paste", {
              clipboardData: transfer,
              bubbles: true,
              cancelable: true,
            }),
          );
        },
        { own, base64: file.buffer.toString("base64") },
      );
    };

    await dispatch(true);

    await expect(
      this.page.getByText(/Чтение редактируемого фрагмента недоступно/).first(),
    ).toBeVisible();

    await this.board.storage.expectScene(original);
    await dispatch(false);
    await this.board.storage.expectStrokeCount(2);

    expect(
      (await this.board.storage.records()).main!.items.filter(
        (item) => item.kind === "image",
      ),
    ).toHaveLength(1);
  }

  async expectMenuUsesSameClipboard() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);
    await this.all();

    await this.page
      .getByRole("button", { name: "Действия", exact: true })
      .click();

    await this.page
      .getByRole("button", { name: "Копировать", exact: true })
      .click();

    await expect(
      this.page
        .getByText("Фрагмент скопирован в системный буфер.", { exact: true })
        .first(),
    ).toBeVisible();

    await this.page
      .getByRole("button", { name: "Действия", exact: true })
      .click();

    await this.page
      .getByRole("button", { name: "Вставить", exact: true })
      .click();

    await this.board.storage.expectStrokeCount(2);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(1);
  }
}
