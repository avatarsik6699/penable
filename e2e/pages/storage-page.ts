import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TestBoardTypes } from "../data/board.types";

export class StoragePage {
  constructor(private readonly page: Page) {}

  async expectSaved() {
    await expect(
      this.page.getByText("Сохранено локально", { exact: true }),
    ).toBeVisible();
  }

  async records(): Promise<TestBoardTypes.Records> {
    return this.page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("penable");

          request.onerror = () => reject(request.error);

          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("documents", "readonly");
            const result: Record<string, unknown> = {};

            for (const [key, name] of [
              ["main", "main"],
              ["before-import", "previous"],
              ["before-schema2", "upgrade"],
            ]) {
              const read = tx.objectStore("documents").get(key!);

              read.onsuccess = () => {
                result[name!] = read.result;
              };
            }

            tx.oncomplete = () => {
              db.close();
              resolve(result);
            };

            tx.onabort = () => {
              db.close();
              reject(tx.error);
            };
          };
        }),
    );
  }

  async expectStrokeCount(count: number) {
    await expect
      .poll(async () => (await this.records()).main?.strokes.length ?? 0)
      .toBe(count);

    await this.expectSaved();
  }

  async sceneFingerprint(): Promise<string> {
    return this.page.evaluate(async () => {
      const strokes = await new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("penable");

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("documents", "readonly");
          const read = transaction.objectStore("documents").get("main");

          transaction.oncomplete = () => {
            db.close();
            resolve(read.result?.strokes ?? []);
          };

          transaction.onabort = () => {
            db.close();
            reject(transaction.error);
          };
        };
      });

      const canonical = (value: unknown): unknown =>
        Array.isArray(value)
          ? value.map(canonical)
          : value && typeof value === "object"
            ? Object.fromEntries(
                Object.entries(value)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, entry]) => [key, canonical(entry)]),
              )
            : value;

      const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(canonical(strokes))),
      );

      return [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    });
  }

  async expectFingerprint(fingerprint: string) {
    await expect.poll(() => this.sceneFingerprint()).toBe(fingerprint);
    await this.expectSaved();
  }

  async expectScene(strokes: TestBoardTypes.Stroke[]) {
    const canonical = (value: unknown): unknown =>
      Array.isArray(value)
        ? value.map(canonical)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonical(entry)]),
            )
          : value;

    await this.expectFingerprint(
      createHash("sha256")
        .update(JSON.stringify(canonical(strokes)))
        .digest("hex"),
    );
  }

  async expectRecovery(
    kind: "previous" | "upgrade",
    document: TestBoardTypes.Document,
  ) {
    await expect
      .poll(async () => (await this.records())[kind])
      .toEqual(document);
  }

  async openBoardMenu() {
    const trigger = this.page.getByRole("button", {
      name: "Меню доски",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  async beginImport() {
    await this.openBoardMenu();

    await this.page
      .getByRole("button", { name: "Импорт", exact: true })
      .click();
  }

  async closeDetails() {
    const close = this.page.getByRole("button", {
      name: "Закрыть сведения о хранении",
      exact: true,
    });

    if (await close.isVisible()) await close.click();

    const boardClose = this.page.getByRole("button", {
      name: "Закрыть меню доски",
      exact: true,
    });

    if (await boardClose.isVisible()) await boardClose.click();
  }

  async importDocument(document: unknown) {
    await this.beginImport();

    const dialog = this.page.getByRole("dialog", {
      name: "Импорт доски",
      exact: true,
    });

    await expect(dialog).toBeVisible();

    await dialog.locator("input[type=file]").setInputFiles({
      name: "owned-board.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(document)),
    });

    await expect(
      dialog.getByRole("button", { name: "Заменить доску", exact: true }),
    ).toBeEnabled();

    await dialog
      .getByRole("button", { name: "Заменить доску", exact: true })
      .click();

    await expect(dialog).toBeHidden();
    await this.expectSaved();
    await this.closeDetails();
  }

  async rejectInvalidImport() {
    const previous = (await this.records()).main;

    await this.beginImport();

    const dialog = this.page.getByRole("dialog", {
      name: "Импорт доски",
      exact: true,
    });

    await dialog.locator("input[type=file]").setInputFiles({
      name: "bad-board.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"schemaVersion":99}'),
    });

    await expect(dialog.getByRole("alert")).toBeVisible();

    await expect(
      dialog.getByRole("button", { name: "Заменить доску", exact: true }),
    ).toBeDisabled();

    await dialog.getByRole("button", { name: "Отмена", exact: true }).click();
    expect((await this.records()).main).toEqual(previous);
  }

  async exportDocument(): Promise<TestBoardTypes.Document> {
    await this.openBoardMenu();

    const pending = this.page.waitForEvent("download");

    await this.page
      .getByRole("button", { name: "Скачать копию", exact: true })
      .click();

    const download = await pending;

    expect(download.suggestedFilename()).toBe("penable-board.json");

    const path = await download.path();

    expect(path).toBeTruthy();

    const document = JSON.parse(
      await readFile(path!, "utf8"),
    ) as TestBoardTypes.Document;

    await this.closeDetails();

    return document;
  }

  async expectExportMatchesSaved() {
    const exported = await this.exportDocument();

    expect(exported).toEqual((await this.records()).main);
    expect(exported.format).toBe("penable-board");
    expect(exported.schemaVersion).toBe(2);
  }

  async expectReadOnly() {
    await this.openBoardMenu();

    await expect(
      this.page.getByText("Только просмотр", { exact: true }),
    ).toBeVisible();

    await expect(
      this.page.getByRole("button", { name: "Перо", exact: true }),
    ).toBeDisabled();

    await expect(
      this.page.getByRole("button", { name: "Импорт", exact: true }),
    ).toBeDisabled();

    await this.closeDetails();
  }

  async expectSaveError() {
    await expect(
      this.page.getByText("Не удалось сохранить", { exact: true }),
    ).toBeVisible();
  }

  async retrySave() {
    await this.page
      .getByRole("button", { name: "Хранение", exact: true })
      .click();

    await expect(
      this.page.getByRole("button", {
        name: "Повторить сохранение",
        exact: true,
      }),
    ).toBeVisible();

    await this.page
      .getByRole("button", { name: "Повторить сохранение", exact: true })
      .click();

    await this.expectSaved();
    await this.closeDetails();
  }
}
