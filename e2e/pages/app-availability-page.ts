import { expect, type BrowserContext, type Page } from "@playwright/test";
import { BoardPage } from "./board-page";
import { StoragePage } from "./storage-page";

export class AppAvailabilityPage {
  constructor(
    private page: Page,
    private readonly context: BrowserContext,
    private board: BoardPage,
    private readonly setVersion: (
      version: "original" | "update" | "broken",
    ) => void,
  ) {}

  private async ready() {
    await expect
      .poll(() =>
        this.page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();

          return registration?.active?.state === "activated";
        }),
      )
      .toBe(true);
  }

  private async controlled() {
    await this.ready();
    await this.page.reload();
    await this.board.storage.expectSaved();

    await this.page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 5000 },
    );
  }

  async expectOfflineWriting() {
    await this.controlled();
    await this.board.drawStroke();
    await this.context.setOffline(true);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(1);
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(2);

    await this.page
      .getByRole("button", { name: "Миникарта", exact: true })
      .click();

    await expect(
      this.page.getByRole("region", { name: "Миникарта доски", exact: true }),
    ).toBeVisible();

    await this.page.keyboard.press("Escape");
    await this.board.storage.expectExportMatchesSaved();
    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(2);
  }

  private async currentCache() {
    return this.page.evaluate(async () =>
      (await caches.keys()).filter((key) => key.startsWith("penable-shell:")),
    );
  }

  private async upgrade(version: "update" | "broken") {
    this.setVersion(version);

    const state = await this.page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;

      const completion = new Promise<string>((resolve) => {
        registration.addEventListener(
          "updatefound",
          () => {
            const worker = registration.installing!;

            worker.addEventListener("statechange", () => {
              if (worker.state === "installed" || worker.state === "redundant")
                resolve(worker.state);
            });
          },
          { once: true },
        );
      });

      await registration.update();

      return completion;
    });

    expect(state).toBe(version === "broken" ? "redundant" : "installed");
  }

  async expectSafeUpgrade() {
    await this.controlled();
    await this.board.drawStroke();

    const original = await this.currentCache();
    const fingerprint = await this.board.storage.sceneFingerprint();

    await this.page.evaluate(async () => {
      await caches.open("unrelated-owned-test");
    });

    await this.upgrade("update");

    await expect
      .poll(() =>
        this.page.evaluate(async () =>
          Boolean((await navigator.serviceWorker.getRegistration())?.waiting),
        ),
      )
      .toBe(true);

    await this.board.storage.expectFingerprint(fingerprint);
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(2);
    await expect.poll(() => this.currentCache()).toHaveLength(2);
    await this.page.close();
    this.page = await this.context.newPage();
    this.board = new BoardPage(this.page, new StoragePage(this.page));
    await this.board.open();
    await this.ready();
    await expect.poll(() => this.currentCache()).toHaveLength(1);
    expect(await this.currentCache()).not.toEqual(original);

    expect(
      await this.page.evaluate(() => caches.has("unrelated-owned-test")),
    ).toBe(true);

    await this.context.setOffline(true);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(2);
  }

  async expectFailedUpgrade() {
    await this.controlled();
    await this.board.drawStroke();

    const originalCache = await this.currentCache();

    const original = await this.page.evaluate(
      () => navigator.serviceWorker.controller!.scriptURL,
    );

    await this.upgrade("broken");

    expect(
      await this.page.evaluate(
        () => navigator.serviceWorker.controller!.scriptURL,
      ),
    ).toBe(original);

    await expect.poll(() => this.currentCache()).toEqual(originalCache);
    await this.context.setOffline(true);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(1);
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(2);
  }

  async expectPreparationRetry() {
    await this.page
      .getByRole("button", { name: "Приложение и офлайн", exact: true })
      .click();

    const panel = this.page.getByRole("dialog", {
      name: "Приложение и офлайн",
      exact: true,
    });

    await expect(panel.getByRole("status")).toHaveText(
      "Не удалось подготовить работу без интернета",
    );

    await this.page.keyboard.press("Escape");
    await this.board.drawStroke();
    this.setVersion("original");

    await this.page
      .getByRole("button", { name: "Приложение и офлайн", exact: true })
      .click();

    await panel
      .getByRole("button", { name: "Повторить подготовку", exact: true })
      .click();

    await expect(panel.getByRole("status")).toHaveText(
      "Готово к работе без интернета",
    );

    await this.page.keyboard.press("Escape");
    await this.context.setOffline(true);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(1);
  }

  async expectInstallLifecycle() {
    await this.ready();

    await this.page
      .getByRole("button", { name: "Приложение и офлайн", exact: true })
      .click();

    const panel = this.page.getByRole("dialog", {
      name: "Приложение и офлайн",
      exact: true,
    });

    await expect(panel.getByRole("status")).toHaveText(
      "Готово к работе без интернета",
    );

    const install = panel.getByRole("button", {
      name: "Установить penable",
      exact: true,
    });

    await this.page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });

      Object.assign(event, {
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });

      window.dispatchEvent(event);
    });

    await expect(install).toBeVisible();
    await install.click();
    await expect(install).toBeHidden();

    await this.page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });

      Object.assign(event, {
        prompt: () => Promise.reject(new Error("Owned prompt failure")),
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });

      window.dispatchEvent(event);
    });

    await install.click();
    await expect(panel.getByText(/Не удалось открыть установку/)).toBeVisible();

    await this.page.evaluate(() =>
      window.dispatchEvent(new Event("appinstalled")),
    );

    await expect(
      panel.getByText("penable открыто как приложение."),
    ).toBeVisible();

    await expect(install).toBeHidden();
    await this.page.keyboard.press("Escape");
    await expect(panel).toBeHidden();

    await expect(
      this.page.getByRole("button", {
        name: "Приложение и офлайн",
        exact: true,
      }),
    ).toBeFocused();
  }

  async expectScopedAssets() {
    await this.controlled();

    const manifest = await this.page.evaluate(async () => {
      const link = document.querySelector<HTMLLinkElement>(
        'link[rel="manifest"]',
      )!;

      return (await fetch(link.href)).json();
    });

    expect(manifest.start_url).toBe("/penable/");
    expect(manifest.scope).toBe("/penable/");
    expect(manifest.display).toBe("standalone");

    const urls = await this.page.evaluate(async () => {
      const name = (await caches.keys()).find((key) =>
        key.startsWith("penable-shell:"),
      )!;

      return (await (await caches.open(name)).keys()).map(
        (request) => request.url,
      );
    });

    expect(urls.length).toBeGreaterThan(8);

    expect(
      urls.every((url) => new URL(url).pathname.startsWith("/penable/")),
    ).toBe(true);

    expect(urls.some((url) => /jobs-worker/.test(url))).toBe(true);
    expect(urls.some((url) => /fragment-reader-worker/.test(url))).toBe(true);
    expect(urls.some((url) => /thumbnail-worker/.test(url))).toBe(true);
  }
}
