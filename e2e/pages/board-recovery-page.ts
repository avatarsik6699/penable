import { expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

export class BoardRecoveryPage {
  constructor(
    private readonly page: Page,
    private readonly original: Record<string, unknown>,
  ) {}

  private button(name: string | RegExp) {
    return this.page.getByRole("button", { name, exact: true });
  }

  private async openFiles() {
    const settings = this.button(/^(Board settings|Настройки доски)$/);

    if ((await settings.getAttribute("aria-expanded")) !== "true")
      await settings.click();

    await this.page
      .getByRole("tab", { name: /^(Files and copies|Файлы и копии)$/ })
      .click();
  }

  private async download(name: RegExp) {
    const downloading = this.page.waitForEvent("download");

    await this.button(name).click();

    const download = await downloading;
    const path = await download.path();

    if (!path) throw new Error("Recovery download is unavailable");

    return JSON.parse(await readFile(path, "utf8"));
  }

  private async expectRecordsUnchanged() {
    const records = await this.page.evaluate(
      () =>
        new Promise<Record<string, unknown>>((resolve, reject) => {
          const request = indexedDB.open("penable");

          request.onerror = () => reject(request.error);

          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction("documents", "readonly");
            const cursor = tx.objectStore("documents").openCursor();
            const result: Record<string, unknown> = {};

            cursor.onsuccess = () => {
              if (cursor.result) {
                result[String(cursor.result.key)] = cursor.result.value;
                cursor.result.continue();
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

    expect(records).toEqual(this.original);
  }

  private async expectNewerSelectionWins() {
    // Hold a real storage worker's terminal packet until the second board is visible.
    await this.page.evaluate(() => {
      const NativeWorker = window.Worker;

      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);

          if (!String(url).includes("document-storage-worker")) return;

          window.Worker = NativeWorker;

          this.addEventListener(
            "message",
            (event: MessageEvent) => {
              if (
                event.data.type !== "finish" ||
                Reflect.has(window, "__releaseRecovery46")
              )
                return;

              event.stopImmediatePropagation();

              Object.defineProperty(window, "__releaseRecovery46", {
                value: () => {
                  this.dispatchEvent(
                    new MessageEvent("message", { data: event.data }),
                  );
                },
              });
            },
            true,
          );
        }
      };
    });

    await this.button("Geometry").click();

    await this.page.waitForFunction(() =>
      Reflect.has(window, "__releaseRecovery46"),
    );

    await this.button("Notebook").click();

    await expect(this.page.locator("[data-background]")).toHaveAttribute(
      "data-background",
      "dots",
    );

    await this.page.evaluate(async () => {
      (
        window as unknown as { __releaseRecovery46: () => void }
      ).__releaseRecovery46();

      await new Promise<void>((done) =>
        requestAnimationFrame(() => requestAnimationFrame(() => done())),
      );
    });

    await expect(this.button("Notebook")).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await expect(this.page.locator("[data-background]")).toHaveAttribute(
      "data-background",
      "dots",
    );
  }

  async expectReadOnlyBrowsing() {
    await this.openFiles();

    await this.expectNewerSelectionWins();

    const recovery = this.page.getByRole("region", {
      name: /^(Recover boards|Восстановление досок)$/,
    });

    await recovery
      .getByRole("button", { name: "Unavailable", exact: true })
      .click();

    await expect(recovery).toContainText(
      /(Could not open|Не удалось открыть).*Unavailable/i,
    );

    for (const [title, background] of [
      ["Geometry", "grid"],
      ["Notebook", "dots"],
    ] as const) {
      const choice = recovery.getByRole("button", { name: title, exact: true });

      await choice.focus();
      await choice.press("Enter");

      await expect(this.page.locator("[data-background]")).toHaveAttribute(
        "data-background",
        background,
      );

      await expect(this.button(/^(Pen|Перо)$/)).toBeDisabled();

      const copy = await this.download(/^(Download copy|Скачать копию)$/);

      expect(copy.background).toBe(background);
      expect(copy.items).toHaveLength(1);
    }

    await this.button(
      /^(Close board settings|Закрыть настройки доски)$/,
    ).click();

    await expect(
      this.page.getByRole("status").filter({ hasText: /Notebook/ }),
    ).toBeVisible();

    await this.button(/^(Zoom in board|Увеличить масштаб доски)$/).click();
    await expect(this.button(/^(Zoom|Масштаб) 200/)).toBeVisible();
    await this.openFiles();

    const raw = await this.download(/^(Original record|Исходная запись)$/);

    expect(raw).toEqual(this.original.main);

    await recovery
      .getByRole("button", { name: /^(Close preview|Закрыть просмотр)$/ })
      .click();

    await expect(this.page.getByTestId("board-live")).toHaveCount(0);
    await this.expectRecordsUnchanged();
    await this.button(/^(Reconnect|Повторить подключение)$/).click();

    await expect(
      recovery.getByRole("button", { name: "Geometry" }),
    ).toBeVisible();

    await this.page.reload();
    await this.openFiles();
    await expect(recovery).toBeVisible();
    await this.expectRecordsUnchanged();
  }
}
