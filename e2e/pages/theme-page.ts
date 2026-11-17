import { expect, type BrowserContext, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import type { StoragePage } from "./storage-page";

type Theme = "light" | "dark";

type Preference = Theme | "system";

export class ThemePage {
  constructor(
    private readonly page: Page,
    private readonly context: BrowserContext,
    private readonly storage: StoragePage,
    private readonly reader: Page | undefined,
    private readonly palette: readonly string[],
  ) {}

  private async open() {
    await this.page.goto("/penable/");
    await expect(this.page.getByTestId("board-live")).toBeVisible();
    await this.storage.expectSaved();
    await this.expectTheme("light");
  }

  private async expectTheme(theme: Theme, page = this.page) {
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);

    await expect
      .poll(() =>
        page
          .locator("html")
          .evaluate((node) => getComputedStyle(node).colorScheme),
      )
      .toBe(theme);
  }

  private async settings(page = this.page) {
    const select = page.getByRole("combobox", { name: "Тема", exact: true });

    if (!(await select.isVisible())) {
      const trigger = page.getByRole("button", {
        name: "Настройки доски",
        exact: true,
      });

      if ((await trigger.getAttribute("aria-expanded")) !== "true")
        await trigger.click();

      await page.getByRole("tab", { name: "Вид", exact: true }).click();
    }

    return select;
  }

  private async choose(
    preference: Preference,
    effective: Theme,
    page = this.page,
  ) {
    const select = await this.settings(page);

    await select.selectOption(preference);
    await expect(select).toHaveValue(preference);
    await this.expectTheme(effective, page);
    await page.keyboard.press("Escape");
    await this.settle(page);
  }

  private async settle(page = this.page) {
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
  }

  private async raster(testId = "board-completed") {
    return this.page
      .getByTestId(testId)
      .evaluate((node) => (node as HTMLCanvasElement).toDataURL());
  }

  private async samples() {
    return this.page.getByTestId("board-completed").evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();
      const readback = document.createElement("canvas");

      readback.width = canvas.width;
      readback.height = canvas.height;

      const context = readback.getContext("2d", { willReadFrequently: true })!;

      context.drawImage(canvas, 0, 0);

      const pixel = (x: number, y: number) => [
        ...context.getImageData(
          Math.round((x * canvas.width) / bounds.width),
          Math.round((y * canvas.height) / bounds.height),
          1,
          1,
        ).data,
      ];

      return {
        ink: [0, 1, 2].map((row) =>
          Array.from({ length: 10 }, (_, column) =>
            pixel(110 + column * 105, 210 + row * 80),
          ),
        ),
        image: [pixel(970, 520), pixel(1080, 520), pixel(970, 590)],
        fill: pixel(180, 570),
      };
    });
  }

  private async draw(y = 300) {
    const bounds = await this.page.getByTestId("board-live").boundingBox();

    if (!bounds) throw new Error("Missing writing canvas");

    await this.page.mouse.move(bounds.x + 200, bounds.y + y);
    await this.page.mouse.down();
    await this.page.mouse.move(bounds.x + 500, bounds.y + y, { steps: 20 });
    await this.page.mouse.up();
    await this.storage.expectSaved();
  }

  private async selectAll() {
    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.page.getByTestId("board-live").focus();
    await this.page.keyboard.press("Control+a");

    await expect(
      this.page.getByTestId("selection-handles"),
    ).not.toHaveAttribute("d", "");
  }

  private async png() {
    await this.selectAll();

    await this.page
      .getByRole("button", { name: "Действия", exact: true })
      .click();

    const pending = this.page.waitForEvent("download");

    await this.page
      .getByRole("button", { name: "Скачать PNG", exact: true })
      .click();

    const download = await pending;
    const path = await download.path();

    if (!path) throw new Error("Missing selection PNG");

    return readFile(path);
  }

  private async clipboard() {
    await this.selectAll();
    await this.page.keyboard.press("Control+c");

    await expect(
      this.page
        .getByText("Фрагмент скопирован в системный буфер.", { exact: true })
        .first(),
    ).toBeVisible();

    return this.page.evaluate(async () => {
      const item = (await navigator.clipboard.read())[0]!;

      const png = new Uint8Array(
        await (await item.getType("image/png")).arrayBuffer(),
      );

      const fragment = await (
        await item.getType("web application/x-penable-fragment+json")
      ).text();

      const hash = [
        ...new Uint8Array(await crypto.subtle.digest("SHA-256", png)),
      ]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      return { hash, fragment };
    });
  }

  async preferenceLifecycle() {
    await this.open();
    await expect(await this.settings()).toHaveValue("light");
    await this.choose("dark", "dark");
    await this.page.reload();
    await this.expectTheme("dark");
    await this.page.emulateMedia({ colorScheme: "light" });
    await this.expectTheme("dark");
    await this.choose("system", "light");
    await this.page.emulateMedia({ colorScheme: "dark" });
    await this.expectTheme("dark");
    await this.page.emulateMedia({ colorScheme: "light" });
    await this.expectTheme("light");
    await this.choose("light", "light");
    await this.page.emulateMedia({ colorScheme: "dark" });
    await this.expectTheme("light");

    await this.page.evaluate(() =>
      localStorage.setItem("penable:theme", "invalid-theme"),
    );

    await this.page.reload();
    await this.expectTheme("light");
    await expect(await this.settings()).toHaveValue("light");
  }

  async mixedRasterAndExports() {
    await this.open();
    await this.storage.expectStrokeCount(34);

    await expect
      .poll(async () => (await this.samples()).image[0]![3])
      .toBe(255);

    const before = await this.storage.records();
    const lightRaster = await this.raster();
    const light = await this.samples();
    const png = await this.png();
    const clipboard = await this.clipboard();

    for (const [index, color] of this.palette.entries()) {
      const rgb = color
        .slice(1)
        .match(/../g)!
        .map((part) => parseInt(part, 16));

      expect(light.ink[0]![index]).toEqual([...rgb, 255]);
      expect(light.ink[1]![index]).toEqual([...rgb, 255]);
      expect(light.ink[2]![index]![3]).toBeGreaterThan(70);
      expect(light.ink[2]![index]![3]).toBeLessThan(80);
    }

    await this.choose("dark", "dark");
    await expect.poll(() => this.raster()).not.toBe(lightRaster);

    const dark = await this.samples();

    expect(dark.image).toEqual(light.image);
    expect(dark.fill).not.toEqual(light.fill);
    expect(dark.ink[0]![0]![0]).toBeGreaterThan(200);

    for (const [row, colors] of dark.ink.entries())
      for (const [index, pixel] of colors.entries()) {
        expect(pixel[3]).toBe(light.ink[row]![index]![3]);

        expect(pixel.slice(0, 3).reduce((a, b) => a + b, 0)).toBeGreaterThan(
          180,
        );
      }

    expect(await this.png()).toEqual(png);
    expect(await this.clipboard()).toEqual(clipboard);
    expect(await this.storage.records()).toEqual(before);
    expect(await this.storage.exportDocument()).toEqual(before.main);
    await this.choose("light", "light");
    await expect.poll(() => this.raster()).toBe(lightRaster);
    expect(await this.samples()).toEqual(light);
    expect(await this.storage.records()).toEqual(before);
  }

  async activeInputAndHistory() {
    await this.open();
    await this.page.emulateMedia({ colorScheme: "light" });
    await this.choose("system", "light");

    const canvas = this.page.getByTestId("board-live");

    await canvas.evaluate((node) =>
      node.setAttribute("data-theme-identity", "original"),
    );

    const bounds = await canvas.boundingBox();

    if (!bounds) throw new Error("Missing writing canvas");

    await this.page.mouse.move(bounds.x + 200, bounds.y + 300);
    await this.page.mouse.down();
    await this.page.mouse.move(bounds.x + 350, bounds.y + 300, { steps: 12 });
    await this.page.emulateMedia({ colorScheme: "dark" });
    await this.expectTheme("dark");
    await this.settle();

    const active = await canvas.evaluate((node) => {
      const canvas = node as HTMLCanvasElement;
      const bounds = canvas.getBoundingClientRect();

      const pixel = canvas
        .getContext("2d")!
        .getImageData(
          Math.round((275 * canvas.width) / bounds.width),
          Math.round((300 * canvas.height) / bounds.height),
          1,
          1,
        ).data;

      return [...pixel];
    });

    expect(active[0]).toBeGreaterThan(200);
    expect(active[3]).toBe(255);
    await this.page.mouse.move(bounds.x + 500, bounds.y + 300, { steps: 12 });
    await this.page.mouse.up();
    await this.storage.expectStrokeCount(1);
    await expect(canvas).toHaveAttribute("data-theme-identity", "original");

    const ink = (await this.storage.records()).main!.items[0]!;

    if (ink.kind !== "ink") throw new Error("Expected committed ink");

    expect(ink.color).toBe("#182230");
    expect(ink.points[0]!.x).toBeCloseTo(200, 5);
    expect(ink.points.at(-1)!.x).toBeCloseTo(500, 5);
    expect(ink.points.length).toBeGreaterThan(20);

    await this.page
      .getByRole("button", { name: "Отменить действие", exact: true })
      .click();

    await this.storage.expectStrokeCount(0);
    await this.choose("light", "light");

    await this.page
      .getByRole("button", { name: "Вернуть действие", exact: true })
      .click();

    await this.storage.expectStrokeCount(1);
    expect((await this.storage.records()).main!.items[0]).toEqual(ink);
  }

  async selectionSurvives() {
    await this.open();
    await this.draw();
    await this.storage.expectStrokeCount(1);
    await this.selectAll();

    const canvas = this.page.getByTestId("board-live");

    const outline = this.page
      .getByTestId("board-selection")
      .locator("path")
      .first();

    const selection = await outline.getAttribute("d");
    const before = await this.storage.records();

    await canvas.evaluate((node) =>
      node.setAttribute("data-theme-identity", "original"),
    );

    await this.choose("dark", "dark");
    await expect(canvas).toHaveAttribute("data-theme-identity", "original");
    await expect(outline).toHaveAttribute("d", selection!);
    expect(await this.storage.records()).toEqual(before);
    await this.choose("light", "light");
    await expect(outline).toHaveAttribute("d", selection!);

    await this.page
      .getByRole("button", { name: "Отменить действие", exact: true })
      .click();

    await this.storage.expectStrokeCount(0);
  }

  async readonlyAndCrossTab() {
    await this.open();
    await this.draw();
    await this.storage.expectStrokeCount(1);

    const before = await this.storage.records();
    const reader = this.reader;

    if (!reader) throw new Error("Missing readonly theme page");

    await reader.goto("/penable/");
    await expect(reader.getByTestId("board-live")).toBeVisible();

    await expect(
      reader.getByRole("button", { name: "Перо", exact: true }),
    ).toBeDisabled();

    await this.choose("dark", "dark", reader);
    await this.expectTheme("dark");
    await this.choose("light", "light");
    await this.expectTheme("light", reader);
    expect(await this.storage.records()).toEqual(before);

    await this.page.evaluate(() => localStorage.removeItem("penable:theme"));
    await this.expectTheme("light", reader);
    await reader.reload();
    await this.expectTheme("light", reader);
  }

  async deniedPersistence() {
    await this.open();
    await this.choose("dark", "dark");
    await this.settings();

    await expect(
      this.page
        .getByText(/тема.*(?:сохран|закрыт)|(?:сохран|закрыт).*тема/i)
        .first(),
    ).toBeVisible();

    await this.page.keyboard.press("Escape");
    await this.draw();
    await this.storage.expectStrokeCount(1);
    await this.page.reload();
    await this.expectTheme("light");
    await this.storage.expectStrokeCount(1);
  }

  async narrowOffline() {
    await this.open();
    await this.draw();
    await this.storage.expectStrokeCount(1);
    await this.page.setViewportSize({ width: 390, height: 844 });

    const select = await this.settings();

    await select.focus();
    await expect(select).toBeFocused();
    await expect(select).toBeInViewport();
    await this.choose("dark", "dark");
    await this.settings();

    await expect(
      this.page.getByRole("combobox", { name: "Язык", exact: true }),
    ).toBeInViewport();

    await this.page.keyboard.press("Escape");

    await expect
      .poll(() =>
        this.page.evaluate(
          async () =>
            (await navigator.serviceWorker.getRegistration())?.active?.state ===
            "activated",
        ),
      )
      .toBe(true);

    await this.page.reload();
    await this.expectTheme("dark");

    await expect
      .poll(() =>
        this.page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
      )
      .toBe(true);

    await this.context.setOffline(true);

    try {
      await this.page.reload();
      await this.expectTheme("dark");
      await this.storage.expectStrokeCount(1);
      await this.choose("light", "light");
      await this.page.reload();
      await this.expectTheme("light");
      await this.storage.expectStrokeCount(1);
    } finally {
      await this.context.setOffline(false);
    }
  }
}
