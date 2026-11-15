import { test as base, expect, type Browser } from "@playwright/test";
import { LocalizationPage } from "../pages/localization-page";

type Fixtures = {
  englishApp: LocalizationPage;
  russianApp: LocalizationPage;
  readerApp: LocalizationPage;
  unsupportedApp: LocalizationPage;
  deniedPreferenceApp: LocalizationPage;
  saveErrorApp: LocalizationPage;
};

async function localized(
  browser: Browser,
  locale: string,
  provide: (app: LocalizationPage) => Promise<void>,
  fault: "none" | "preference" | "save" | "reader" = "none",
) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:4185/penable/",
    locale,
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });

  const errors: string[] = [];
  let blocked = 0;

  context.on("page", (page) => {
    page.on("pageerror", (error) => errors.push(error.message));

    page.on("console", (message) => {
      if (!["warning", "error"].includes(message.type())) return;

      if (
        fault === "save" &&
        /\/assets\/.*worker.*\.js/i.test(message.location().url) &&
        /Failed to load resource.*ERR_FAILED/.test(message.text())
      )
        return;

      errors.push(message.text());
    });
  });

  if (fault === "preference")
    await context.addInitScript(() => {
      const get = Storage.prototype.getItem;
      const set = Storage.prototype.setItem;
      const remove = Storage.prototype.removeItem;

      const deny = (key: string) => {
        if (key === "penable:language")
          throw new DOMException("Preference storage denied", "SecurityError");
      };

      Storage.prototype.getItem = function (key) {
        deny(key);

        return get.call(this, key);
      };

      Storage.prototype.setItem = function (key, value) {
        deny(key);
        set.call(this, key, value);
      };

      Storage.prototype.removeItem = function (key) {
        deny(key);
        remove.call(this, key);
      };
    });

  if (fault === "save") {
    await context.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
    });

    await context.route(/\/assets\/[^/]*worker[^/]*\.js$/i, (route) => {
      blocked++;

      return route.abort("failed");
    });
  }

  try {
    await provide(
      new LocalizationPage(
        await context.newPage(),
        context,
        fault === "reader" ? await context.newPage() : undefined,
      ),
    );
  } finally {
    await context.close();
    expect(errors, "Unexpected locale runtime errors/warnings").toEqual([]);

    if (fault === "save")
      expect(blocked, "Actual durable worker load must fail").toBeGreaterThan(
        0,
      );
  }
}

export const test = base.extend<Fixtures>({
  englishApp: async ({ browser }, provide) => {
    await localized(browser, "en-US", provide);
  },

  readerApp: async ({ browser }, provide) => {
    await localized(browser, "en-US", provide, "reader");
  },

  russianApp: async ({ browser }, provide) => {
    await localized(browser, "ru-RU", provide);
  },

  unsupportedApp: async ({ browser }, provide) => {
    await localized(browser, "de-DE", provide);
  },

  deniedPreferenceApp: async ({ browser }, provide) => {
    await localized(browser, "en-US", provide, "preference");
  },

  saveErrorApp: async ({ browser }, provide) => {
    await localized(browser, "en-US", provide, "save");
  },
});
