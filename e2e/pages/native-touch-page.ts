import { expect, type CDPSession, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";

type TouchPoint = { id: number; x: number; y: number };

export class NativeTouchPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly session: CDPSession,
  ) {}

  private async send(
    type: "touchStart" | "touchEnd" | "touchMove" | "touchCancel",
    points: TouchPoint[],
  ) {
    const box = (await this.board.surface.boundingBox())!;

    await this.session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: points.map((point) => ({
        id: point.id,
        x: box.x + point.x,
        y: box.y + point.y,
        radiusX: 4,
        radiusY: 4,
        force: 0.5,
      })),
    });
  }

  private async viewport() {
    return (await this.board.storage.records()).main!.viewport;
  }

  async expectNativeTouchNavigation() {
    const initial = await this.viewport();

    await this.send("touchStart", [{ id: 11, x: 300, y: 500 }]);

    for (let i = 1; i <= 6; i++)
      await this.send("touchMove", [
        { id: 11, x: 300 + i * 10, y: 500 + i * (40 / 6) },
      ]);

    await this.send("touchEnd", []);

    await expect
      .poll(async () => (await this.viewport()).x)
      .toBeCloseTo(initial.x + 60, 4);

    const panned = await this.viewport();

    expect(panned.y).toBeCloseTo(initial.y + 40, 4);
    await this.send("touchStart", [{ id: 11, x: 300, y: 500 }]);

    await this.send("touchStart", [
      { id: 11, x: 300, y: 500 },
      { id: 12, x: 500, y: 500 },
    ]);

    for (let i = 1; i <= 6; i++)
      await this.send("touchMove", [
        { id: 11, x: 300 - i * 5, y: 500 + i * (20 / 6) },
        { id: 12, x: 500 + i * (70 / 6), y: 500 + i * (20 / 6) },
      ]);

    await this.send("touchEnd", []);

    await expect
      .poll(async () => (await this.viewport()).zoom)
      .toBeCloseTo(initial.zoom * 1.5, 4);

    const zoomed = await this.viewport();

    expect(zoomed.x).toBeCloseTo(
      420 - ((400 - panned.x) / panned.zoom) * zoomed.zoom,
      3,
    );

    expect(zoomed.y).toBeCloseTo(
      520 - ((500 - panned.y) / panned.zoom) * zoomed.zoom,
      3,
    );

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectSafeAreaInsets() {
    await this.session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: { top: 30, left: 20, right: 20, bottom: 24 },
    });

    const dock = this.page.locator("[data-editor-dock]");

    await expect
      .poll(async () => (await dock.boundingBox())!.y)
      .toBeGreaterThanOrEqual(30);

    const box = (await dock.boundingBox())!;
    const viewport = this.page.viewportSize()!;

    expect(box.x).toBeGreaterThanOrEqual(20);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 20 + 1);

    const navigation = (await this.page
      .getByRole("group", { name: "Масштаб доски", exact: true })
      .boundingBox())!;

    expect(navigation.y + navigation.height).toBeLessThanOrEqual(
      viewport.height - 24 + 1,
    );

    await this.page.getByRole("button", { name: "Доски", exact: true }).tap();

    const library = (await this.page
      .getByRole("complementary", { name: "Мои доски", exact: true })
      .boundingBox())!;

    expect(library.x).toBeGreaterThanOrEqual(20);
    expect(library.y).toBeGreaterThanOrEqual(30);

    expect(library.x + library.width).toBeLessThanOrEqual(
      viewport.width - 20 + 1,
    );

    expect(library.y + library.height).toBeLessThanOrEqual(
      viewport.height - 24 + 1,
    );

    await this.session.send("Emulation.setSafeAreaInsetsOverride", {
      insets: {},
    });

    await this.board.storage.expectStrokeCount(0);
  }
}
