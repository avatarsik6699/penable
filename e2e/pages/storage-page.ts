import { expect, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { TestBoardTypes } from "../data/board.types";

export class StoragePage {
  constructor(private readonly page: Page) {}

  async expectSaved() {
    await expect(
      this.page.getByRole("button", {
        name: "Состояние сохранения",
        exact: true,
      }),
    ).toHaveAccessibleDescription(/Сохранено локально/);
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

            const store = tx.objectStore("documents");
            const catalog = store.get("library");
            const originalCatalog = store.get("before-library-v2");

            originalCatalog.onsuccess = () => {
              result.beforeCatalog2 = originalCatalog.result;
            };

            catalog.onsuccess = () => {
              result.catalog = catalog.result;

              const id = catalog.result?.activeId ?? "main";
              const key = id === "main" ? "main" : `board:${id}`;
              const prefix = id === "main" ? "" : `${key}:`;

              for (const [recordKey, name] of [
                [key, "main"],
                [`${prefix}before-import`, "previous"],
                [`${prefix}before-schema2`, "upgrade"],
                [`${prefix}before-schema3`, "upgrade3"],
                [`${prefix}before-schema4`, "upgrade4"],
                [`${prefix}before-library`, "beforeLibrary"],
              ]) {
                const read = store.get(recordKey!);

                read.onsuccess = () => {
                  result[name!] = read.result;
                };
              }
            };

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
      .poll(async () => (await this.records()).main?.items.length ?? 0)
      .toBe(count);

    await this.expectSaved();
  }

  async clippedTranslations(): Promise<TestBoardTypes.Position[]> {
    return this.page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("penable");

          request.onerror = () => reject(request.error);

          request.onsuccess = () => {
            const db = request.result;
            const transaction = db.transaction("documents", "readonly");
            const store = transaction.objectStore("documents");
            const catalog = store.get("library");
            let result: TestBoardTypes.Position[] = [];

            catalog.onsuccess = () => {
              const id = catalog.result?.activeId ?? "main";
              const read = store.get(id === "main" ? "main" : `board:${id}`);

              read.onsuccess = () => {
                const document: TestBoardTypes.StoredDocument | undefined =
                  read.result;

                result = (document?.items ?? [])
                  .filter((item) => item.clip)
                  .map((item) => ({ x: item.matrix[4], y: item.matrix[5] }));
              };
            };

            transaction.oncomplete = () => {
              db.close();
              resolve(result);
            };

            transaction.onabort = () => {
              db.close();
              reject(transaction.error);
            };
          };
        }),
    );
  }

  async sceneFingerprint(): Promise<string> {
    return this.page.evaluate(async () => {
      const strokes = await new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open("penable");

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction("documents", "readonly");
          const store = transaction.objectStore("documents");
          const catalog = store.get("library");
          let document: TestBoardTypes.StoredDocument | undefined;

          catalog.onsuccess = () => {
            const id = catalog.result?.activeId ?? "main";
            const read = store.get(id === "main" ? "main" : `board:${id}`);

            read.onsuccess = () => {
              document = read.result;
            };
          };

          transaction.oncomplete = () => {
            db.close();
            resolve(document?.items ?? []);
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

  async expectCurrentMetadata(document: TestBoardTypes.Document) {
    const actual = (await this.records()).main!;

    expect(actual.viewport).toEqual(document.viewport);
    expect(actual.tools).toEqual(document.tools);
    expect(actual.background).toBe(document.background);
    expect(actual.backgroundSettings).toEqual(document.backgroundSettings);
    expect(actual.lastWritingView).toEqual(document.lastWritingView);
  }

  async expectRawRecovery(document: unknown) {
    const before = await this.records();

    await this.openFiles();

    const pending = this.page.waitForEvent("download");

    await this.page
      .getByRole("button", { name: "Исходная запись", exact: true })
      .click();

    const download = await pending;
    const path = await download.path();

    expect(path).toBeTruthy();
    expect(JSON.parse(await readFile(path!, "utf8"))).toEqual(document);
    expect(await this.records()).toEqual(before);

    await expect(
      this.page.getByRole("button", { name: "Перо", exact: true }),
    ).toBeDisabled();
  }

  async expectScene(
    strokes: Array<TestBoardTypes.Stroke | TestBoardTypes.Item>,
  ) {
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

    const items = strokes.map((entry) => {
      if ("kind" in entry) return entry;

      const { translation, ...stroke } = entry;

      return {
        ...stroke,
        kind: "ink",
        matrix: [1, 0, 0, 1, translation?.x ?? 0, translation?.y ?? 0],
      };
    });

    await this.expectFingerprint(
      createHash("sha256")
        .update(JSON.stringify(canonical(items)))
        .digest("hex"),
    );
  }

  async expectRecovery(
    kind: "previous" | "upgrade" | "upgrade3" | "upgrade4" | "beforeLibrary",
    document: TestBoardTypes.Document | TestBoardTypes.StoredDocument,
  ) {
    await expect
      .poll(async () => (await this.records())[kind])
      .toEqual(document);
  }

  async openBoardMenu() {
    const trigger = this.page.getByRole("button", {
      name: "Настройки доски",
      exact: true,
    });

    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  }

  async openFiles() {
    await this.openBoardMenu();

    await this.page
      .getByRole("tab", { name: "Файлы и копии", exact: true })
      .click();
  }

  async beginImport() {
    await this.openFiles();

    await this.page
      .getByRole("button", { name: "Импорт", exact: true })
      .click();
  }

  async closeDetails() {
    const close = this.page.getByRole("button", {
      name: "Закрыть настройки доски",
      exact: true,
    });

    if (await close.isVisible()) await close.click();
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

  async exportDocument(): Promise<TestBoardTypes.StoredDocument> {
    await this.openFiles();

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
    ) as TestBoardTypes.StoredDocument;

    await this.closeDetails();

    return document;
  }

  async expectExportMatchesSaved() {
    const exported = await this.exportDocument();

    expect(exported).toEqual((await this.records()).main);
    expect(exported.format).toBe("penable-board");
    expect(exported.schemaVersion).toBe(4);
  }

  async expectReadOnly() {
    await this.openFiles();

    await expect(
      this.page.getByRole("button", {
        name: "Состояние сохранения",
        exact: true,
      }),
    ).toHaveAccessibleDescription(/Только просмотр/);

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
      this.page.getByRole("button", {
        name: "Состояние сохранения",
        exact: true,
      }),
    ).toHaveAccessibleDescription(/Не удалось сохранить/);
  }

  async retrySave() {
    await this.page
      .getByRole("button", { name: "Состояние сохранения", exact: true })
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
