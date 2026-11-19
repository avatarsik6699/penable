import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardLibraryPage } from "./board-library-page";
import type { BoardImagePage } from "./board-image-page";
import type { TestBoardTypes } from "../data/board.types";
import type { TestImageTypes } from "../data/image-files";

const fragmentType = "web application/x-penable-fragment+json";

export class BoardClipboardPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly returnFocus?: () => Promise<void>,
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
    mode:
      | "none"
      | "read-denied"
      | "write-denied"
      | "unavailable"
      | "read-stale-once"
      | "image-stale-once"
      | "opaque-read",
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

    const text = "Выдержка из статьи";

    await this.writeText(text);
    await this.paste();
    await this.expectText(text, 2);
    await image.payload(file, "paste");
    await image.expectImages(1);
    await this.board.storage.expectStrokeCount(3);
  }

  private writeText(value: string) {
    return this.page.evaluate(
      (text) => navigator.clipboard.writeText(text),
      value,
    );
  }

  private async expectText(value: string, itemCount: number) {
    const read = async () => {
      const document = (await this.board.storage.records()).main;

      return document?.items.find((item) => item.kind === "text");
    };

    await expect.poll(async () => (await read())?.text).toBe(value);
    await this.board.storage.expectStrokeCount(itemCount);

    return (await read())!;
  }

  private async actions() {
    await this.page
      .getByRole("button", { name: "Действия", exact: true })
      .click();
  }

  private async openTextEditor() {
    await this.actions();

    const name = "Изменить текст";

    await this.page.getByRole("button", { name, exact: true }).click();

    const dialog = this.page.getByRole("dialog", { name, exact: true });

    const input = dialog.getByRole("textbox", {
      name: "Текст на доске",
      exact: true,
    });

    await expect(input).toBeFocused();

    return { dialog, input };
  }

  private textPoint(item: TestBoardTypes.TextItem) {
    return { x: item.matrix[4] + 20, y: item.matrix[5] + 16 };
  }

  async expectEditableTextRoundtrip(library: BoardLibraryPage) {
    const source = "Фрагмент из книги.\n\nВторой абзац.";
    const edited = "Фрагмент из книги.\n\nУточнённый абзац.";

    await this.board.drawStroke();

    const previous = (await this.board.storage.records()).main!;

    await this.writeText(source);
    await this.paste();

    const text = await this.expectText(source, 2);
    const records = await this.board.storage.records();

    expect(records.main?.schemaVersion).toBe(6);
    expect(records.upgrade6).toEqual(previous);
    expect(text.lines).toHaveLength(3);

    const point = this.textPoint(text);

    await this.board.drawStroke(point, { x: point.x + 75, y: point.y });
    await this.board.reopenSavedBoard();

    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.board.surface.click({ position: point });

    const { dialog, input } = await this.openTextEditor();

    await expect(input).toHaveValue(source);
    await this.writeText("Временный черновик");
    await input.press("Control+a");
    await input.press("Control+v");
    await expect(input).toHaveValue("Временный черновик");
    await input.press("Escape");
    await expect(dialog).toBeHidden();

    await expect(
      this.page.getByRole("button", { name: "Действия", exact: true }),
    ).toBeFocused();

    await this.expectText(source, 3);

    const editor = await this.openTextEditor();

    await editor.input.fill(edited);

    await editor.dialog
      .getByRole("button", { name: "Сохранить", exact: true })
      .click();

    await expect(editor.dialog).toBeHidden();
    await this.expectText(edited, 3);
    await this.board.undo();
    await this.expectText(source, 3);
    await this.board.redo();
    await this.expectText(edited, 3);

    await this.page.getByRole("button", { name: "Перо", exact: true }).click();

    await this.board.selectRectangle(
      { x: text.matrix[4] - 5, y: text.matrix[5] - 5 },
      {
        x: text.matrix[4] + text.width + 5,
        y: text.matrix[5] + text.lines.length * 28 + 5,
      },
    );

    await this.board.moveSelection(point, { x: point.x + 28, y: point.y + 14 });

    await expect
      .poll(async () => (await this.expectText(edited, 3)).matrix[4])
      .toBe(text.matrix[4] + 28);

    const sourceDocument = (await this.board.storage.records()).main!;
    const annotation = sourceDocument.items[2]!;

    expect(annotation.matrix.slice(4)).toEqual([28, 14]);

    await this.actions();

    const download = this.page.waitForEvent("download");

    await this.page.getByRole("button", { name: "Скачать PNG" }).click();
    expect((await download).suggestedFilename()).toBe("penable-selection.png");

    await this.copy();
    await library.create("Цитаты");
    await this.paste();
    await this.expectText(edited, 3);

    const exported = await this.board.storage.exportDocument();

    await library.create("Из файла");
    await this.board.storage.importDocument(exported);
    await this.expectText(edited, 3);
    await this.board.storage.expectScene(exported.items);
  }

  async expectTallTextClipboard() {
    const text = Array.from(
      { length: 150 },
      (_, index) => `Line ${index + 1}`,
    ).join("\n");

    await this.writeText(text);
    await this.paste();

    const original = await this.expectText(text, 1);

    expect(original.lines).toHaveLength(150);
    await this.page.keyboard.press("Control+c");

    await expect(
      this.page
        .getByText(/Редактируемый фрагмент скопирован.*слишком велико/)
        .first(),
    ).toBeVisible();

    const types = await this.page.evaluate(async () =>
      (await navigator.clipboard.read()).flatMap((item) => [...item.types]),
    );

    expect(types).toEqual([fragmentType]);
    await this.paste();
    await this.expectText(text, 2);

    const document = (await this.board.storage.records()).main!;

    expect(document.items).toEqual([
      original,
      expect.objectContaining({ kind: "text", text, lines: original.lines }),
    ]);
  }

  async expectTextMenuAndNarrowEdit() {
    await this.page.setViewportSize({ width: 390, height: 620 });

    const text = "Длинная строка из статьи. ".repeat(14);

    await this.writeText(text);

    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.actions();

    await this.page
      .getByRole("button", { name: "Вставить", exact: true })
      .click();

    const item = await this.expectText(text, 1);

    expect(item.lines.length).toBeGreaterThan(2);
    expect(item.width).toBeLessThan(390);

    const { dialog, input } = await this.openTextEditor();

    await input.fill("x".repeat(8001));

    const save = dialog.getByRole("button", { name: "Сохранить", exact: true });

    await save.click();

    await expect(dialog.getByRole("alert")).toContainText(
      "Текст слишком длинный",
    );

    await expect(save).toBeInViewport();
    await expect(input).toHaveValue("x".repeat(8001));
    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
    await expect(dialog).toBeHidden();
    await this.expectText(text, 1);
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

  private async writeExternalImage(file: TestImageTypes.File) {
    return this.page.evaluate(async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (entry) =>
        entry.charCodeAt(0),
      );

      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": new Blob([bytes], { type: "image/png" }),
        }),
      ]);

      const item = (await navigator.clipboard.read())[0]!;
      const image = await item.getType("image/png");

      return btoa(
        Array.from(new Uint8Array(await image.arrayBuffer()), (byte) =>
          String.fromCharCode(byte),
        ).join(""),
      );
    }, file.buffer.toString("base64"));
  }

  async expectExternalImageRecoversOnFirstPaste(
    file: TestImageTypes.File,
    menu: boolean,
  ) {
    const expected = await this.writeExternalImage(file);

    await this.board.surface.focus();

    if (!this.returnFocus) throw new Error("Focus-return fixture required");

    await this.returnFocus();
    await this.fault(menu ? "read-stale-once" : "image-stale-once");

    if (menu) {
      await this.page
        .getByRole("button", { name: "Выделение", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Действия", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Вставить", exact: true })
        .click();
    } else await this.page.keyboard.press("Control+v");

    await this.board.storage.expectStrokeCount(1);

    const record = (await this.board.storage.records()).main!;

    expect(record.items.map((item) => item.kind)).toEqual(["image"]);
    expect(record.assets).toHaveLength(1);
    expect(record.assets[0]!.base64).toBe(expected);

    const calls = await this.page.evaluate(
      () =>
        (
          window as unknown as {
            __clipboardCalls43: { reads: number; getTypes: number };
          }
        ).__clipboardCalls43,
    );

    expect(calls).toEqual({ reads: 2, getTypes: menu ? 1 : 2 });

    await expect(
      this.page.getByTestId("selection-handles"),
    ).not.toHaveAttribute("d", "");

    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(1);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(record.items);
  }

  async expectOpaqueReadUsesNativeImage(
    file: TestImageTypes.File,
    menu: boolean,
  ) {
    const expected = await this.writeExternalImage(file);

    await this.fault("opaque-read");

    if (menu) {
      await this.page
        .getByRole("button", { name: "Выделение", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Действия", exact: true })
        .click();

      await this.page
        .getByRole("button", { name: "Вставить", exact: true })
        .click();

      await expect(
        this.page
          .getByText(
            "Чтение буфера недоступно. Попробуйте системную вставку (Ctrl+V или Cmd+V).",
            { exact: true },
          )
          .first(),
      ).toBeVisible();

      await this.board.storage.expectStrokeCount(0);

      const reads = await this.page.evaluate(
        () =>
          (window as unknown as { __clipboardCalls43: { reads: number } })
            .__clipboardCalls43.reads,
      );

      expect(reads).toBe(2);
    }

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+v");
    await this.board.storage.expectStrokeCount(1);

    const record = (await this.board.storage.records()).main!;

    expect(record.items.map((item) => item.kind)).toEqual(["image"]);
    expect(record.assets).toHaveLength(1);
    expect(record.assets[0]!.base64).toBe(expected);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectStrokeCount(1);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(record.items);
  }
}
