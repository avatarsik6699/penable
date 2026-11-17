import { test as base, expect, type Browser } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { ThemePage } from "../pages/theme-page";
import { StoragePage } from "../pages/storage-page";
import { themeBoards } from "../data/theme-boards";

type Fixtures = {
  themes: ThemePage;
  mixedThemes: ThemePage;
  deniedTheme: ThemePage;
  readerTheme: ThemePage;
};

async function application(
  browser: Browser,
  provide: (app: ThemePage) => Promise<void>,
  mode: "empty" | "mixed" | "denied" | "reader" = "empty",
) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4185/penable/",
    locale: "ru-RU",
    colorScheme: "dark",
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
    permissions: ["clipboard-read", "clipboard-write"],
  });

  const errors: string[] = [];

  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));

    page.on("console", (message) => {
      if (["warning", "error"].includes(message.type()))
        errors.push(message.text());
    });
  });

  if (mode === "denied")
    await context.addInitScript(() => {
      const originalGet = Storage.prototype.getItem;
      const originalSet = Storage.prototype.setItem;

      Storage.prototype.getItem = function (key) {
        if (key === "penable:theme")
          throw new DOMException("Theme storage denied", "SecurityError");

        return originalGet.call(this, key);
      };

      Storage.prototype.setItem = function (key, value) {
        if (key === "penable:theme")
          throw new DOMException("Theme storage denied", "SecurityError");

        originalSet.call(this, key, value);
      };
    });

  const page = await context.newPage();

  try {
    if (mode === "mixed") {
      const data = themeBoards.mixed(
        await readFile(
          new URL("../data/images/quadrants.png", import.meta.url),
        ),
      );

      const seedUrl = "http://127.0.0.1:4185/__theme_seed";

      await page.route(seedUrl, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: "<!doctype html><title>Owned theme fixture</title>",
        }),
      );

      await page.goto(seedUrl);

      await page.evaluate(
        (document) =>
          new Promise<void>((resolve, reject) => {
            const open = indexedDB.open("penable", 1);

            open.onupgradeneeded = () => {
              open.result.createObjectStore("documents");
            };

            open.onerror = () => reject(open.error);

            open.onsuccess = () => {
              const db = open.result;
              const transaction = db.transaction("documents", "readwrite");

              transaction.objectStore("documents").put(document, "main");

              transaction.oncomplete = () => {
                db.close();
                resolve();
              };

              transaction.onabort = () => {
                db.close();
                reject(transaction.error);
              };
            };
          }),
        data,
      );

      await page.unroute(seedUrl);
    }

    await provide(
      new ThemePage(
        page,
        context,
        new StoragePage(page),
        mode === "reader" ? await context.newPage() : undefined,
        themeBoards.palette,
      ),
    );
  } finally {
    await context.close();
    expect(errors, "Unexpected theme runtime errors/warnings").toEqual([]);
  }
}

export const test = base.extend<Fixtures>({
  themes: async ({ browser }, provide) => {
    await application(browser, provide);
  },

  mixedThemes: async ({ browser }, provide) => {
    await application(browser, provide, "mixed");
  },

  deniedTheme: async ({ browser }, provide) => {
    await application(browser, provide, "denied");
  },

  readerTheme: async ({ browser }, provide) => {
    await application(browser, provide, "reader");
  },
});
