import { expect, type BrowserContext, type Page } from "@playwright/test";
import { StoragePage } from "./storage-page";

type Language = "en" | "ru";

const copy = {
  en: {
    settings: "Board settings",
    language: "Language",
    pen: "Pen",
    undo: "Undo",
    saved: "Saved locally",
    saveStatus: "Save status",
    files: "Files and copies",
    failed: "Could not save",
  },
  ru: {
    settings: "Настройки доски",
    language: "Язык",
    pen: "Перо",
    undo: "Отменить действие",
    saved: "Сохранено локально",
    saveStatus: "Состояние сохранения",
    files: "Файлы и копии",
    failed: "Не удалось сохранить",
  },
};

export class LocalizationPage {
  private readonly storage;
  private language: Language = "en";

  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
    private readonly reader?: Page,
  ) {
    this.storage = new StoragePage(page);
  }

  private async open(language: Language = "en") {
    this.language = language;
    await this.page.goto("/penable/");
    await expect(this.page.getByTestId("board-live")).toBeVisible();
    await this.expectLanguage(language);

    await expect(
      this.page.getByRole("button", {
        name: copy[language].saveStatus,
        exact: true,
      }),
    ).toHaveAccessibleDescription(copy[language].saved);
  }

  private async expectStrokeCount(count: number) {
    await expect
      .poll(async () => (await this.storage.records()).main?.items.length ?? 0)
      .toBe(count);

    await expect(
      this.page.getByRole("button", {
        name: copy[this.language].saveStatus,
        exact: true,
      }),
    ).toHaveAccessibleDescription(copy[this.language].saved);
  }

  private async expectLanguage(language: Language) {
    this.language = language;
    await expect(this.page.locator("html")).toHaveAttribute("lang", language);

    await expect(
      this.page.getByRole("button", { name: copy[language].pen, exact: true }),
    ).toBeVisible();
  }

  private async settings() {
    const select = this.page.getByRole("combobox", {
      name: copy[this.language].language,
      exact: true,
    });

    if (!(await select.isVisible()))
      await this.page
        .getByRole("button", {
          name: copy[this.language].settings,
          exact: true,
        })
        .click();

    return select;
  }

  private async choose(preference: "auto" | Language, effective: Language) {
    const select = await this.settings();

    await select.selectOption(preference);
    this.language = effective;
    await this.expectLanguage(effective);

    await expect(
      this.page.getByRole("combobox", {
        name: copy[effective].language,
        exact: true,
      }),
    ).toHaveValue(preference);
  }

  private async closeSettings() {
    await this.page.keyboard.press("Escape");
  }

  async automaticEnglish() {
    await this.open("en");
    await expect(await this.settings()).toHaveValue("auto");
    await expect(this.page).toHaveTitle(/penable/);
  }

  async automaticRussian() {
    await this.open("ru");
    await expect(await this.settings()).toHaveValue("auto");
  }

  async unsupportedFallsBackAndInvalidPreferenceIsIgnored() {
    await this.open("en");

    await this.page.evaluate(() =>
      localStorage.setItem("penable:language", "not-a-language"),
    );

    await this.page.reload();
    await this.expectLanguage("en");
    await expect(await this.settings()).toHaveValue("auto");
  }

  async manualChoicePersistsAndAutoRestoresBrowser() {
    await this.open("en");
    await this.choose("ru", "ru");
    await this.page.reload();
    await this.expectLanguage("ru");
    await expect(await this.settings()).toHaveValue("ru");
    await this.choose("auto", "en");

    await expect
      .poll(() =>
        this.page.evaluate(() => localStorage.getItem("penable:language")),
      )
      .toBeNull();

    await this.page.reload();
    await this.expectLanguage("en");
  }

  async deniedPreferencesStillAllowSwitchAndWriting() {
    await this.open("en");
    await this.choose("ru", "ru");
    await this.closeSettings();
    await this.draw();
    await this.expectStrokeCount(1);
    await this.page.reload();
    await this.expectLanguage("en");
    await this.expectStrokeCount(1);
  }

  private async draw() {
    const canvas = this.page.getByTestId("board-live");
    const box = await canvas.boundingBox();

    if (!box) throw new Error("Missing writing canvas");

    await this.page.mouse.move(box.x + 150, box.y + 180);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 360, box.y + 220, { steps: 24 });
    await this.page.mouse.up();
  }

  async switchPreservesCanvasDocumentSelectionAndUndo() {
    await this.open("en");
    await this.draw();
    await this.expectStrokeCount(1);

    await this.page
      .getByTestId("board-live")
      .evaluate((node) =>
        node.setAttribute("data-locale-identity", "original"),
      );

    const before = await this.storage.records();

    await this.page
      .getByRole("button", { name: "Selection", exact: true })
      .click();

    const canvas = this.page.getByTestId("board-live");
    const box = await canvas.boundingBox();

    if (!box) throw new Error("Missing writing canvas");

    await this.page.mouse.move(box.x + 120, box.y + 150);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 390, box.y + 250, { steps: 12 });
    await this.page.mouse.up();

    const outline = this.page
      .getByTestId("board-selection")
      .locator("path")
      .first();

    await expect(outline).toHaveAttribute("d", /.+/);

    const selection = await outline.getAttribute("d");

    await this.choose("ru", "ru");
    await expect(canvas).toHaveAttribute("data-locale-identity", "original");
    await expect(outline).toHaveAttribute("d", selection!);
    expect(await this.storage.records()).toEqual(before);
    await this.closeSettings();
    await this.choose("en", "en");
    await this.closeSettings();
    await expect(canvas).toHaveAttribute("data-locale-identity", "original");
    await this.page.getByRole("button", { name: "Undo", exact: true }).click();
    await this.expectStrokeCount(0);
  }

  async readOnlyTabCanChangeApplicationLanguage() {
    await this.open("en");
    await this.draw();
    await this.expectStrokeCount(1);

    const before = await this.storage.records();
    const second = this.reader;

    if (!second) throw new Error("Readonly fixture page missing");

    await second.goto("/penable/");
    await expect(second.getByTestId("board-live")).toBeVisible();

    await expect(
      second.getByRole("button", { name: "Pen", exact: true }),
    ).toBeDisabled();

    await second
      .getByRole("button", { name: "Board settings", exact: true })
      .click();

    await second
      .getByRole("combobox", { name: "Language", exact: true })
      .selectOption("ru");

    await expect(second.locator("html")).toHaveAttribute("lang", "ru");
    await this.expectLanguage("ru");
    this.language = "ru";
    expect(await this.storage.records()).toEqual(before);
  }

  async visibleSaveErrorRetranslates() {
    await this.open("en");

    await this.draw();

    await expect(
      this.page.getByText(copy.en.failed, { exact: true }).first(),
    ).toBeVisible();

    const image = await this.page
      .getByTestId("board-completed")
      .evaluate((node) => (node as HTMLCanvasElement).toDataURL());

    await this.settings();

    await this.page
      .getByRole("tab", { name: copy.en.files, exact: true })
      .click();

    await expect(
      this.page
        .getByText(/Could not process the document in the background/)
        .first(),
    ).toBeVisible();

    await this.choose("ru", "ru");

    await expect(
      this.page.getByText(copy.ru.failed, { exact: true }).first(),
    ).toBeVisible();

    await this.page
      .getByRole("tab", { name: copy.ru.files, exact: true })
      .click();

    await expect(
      this.page
        .getByText(/Не удалось обработать документ в фоновом потоке/)
        .first(),
    ).toBeVisible();

    expect(
      await this.page
        .getByTestId("board-completed")
        .evaluate((node) => (node as HTMLCanvasElement).toDataURL()),
    ).toBe(image);
  }

  async narrowKeyboardAndOfflineReload() {
    await this.open("en");
    await this.draw();
    await this.expectStrokeCount(1);
    await this.page.setViewportSize({ width: 390, height: 844 });

    const select = await this.settings();

    await select.focus();
    await expect(select).toBeFocused();
    await this.choose("ru", "ru");
    await expect(await this.settings()).toBeInViewport();
    await this.closeSettings();

    await expect
      .poll(() =>
        this.page.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration();

          return registration?.active?.state === "activated";
        }),
      )
      .toBe(true);

    await this.page.reload();
    await this.expectLanguage("ru");

    await expect
      .poll(() =>
        this.page.evaluate(async () => {
          if (!navigator.serviceWorker.controller) return false;

          const cachesForShell = (await caches.keys()).filter((key) =>
            key.startsWith("penable-shell:"),
          );

          return cachesForShell.length > 0;
        }),
      )
      .toBe(true);

    await this.context.setOffline(true);

    try {
      await this.page.reload();
      await this.expectLanguage("ru");
      await this.expectStrokeCount(1);
      await this.choose("en", "en");
      await this.closeSettings();
      await this.page.reload();
      await this.expectLanguage("en");
      await this.expectStrokeCount(1);
    } finally {
      await this.context.setOffline(false);
    }
  }
}
