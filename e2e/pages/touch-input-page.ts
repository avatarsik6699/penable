import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { BoardLibraryPage } from "./board-library-page";

type Contact = {
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel";
  id: number;
  x: number;
  y: number;
  pen?: boolean;
  secondary?: boolean;
  pressure?: number;
};

export class TouchInputPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async stream(contacts: Contact[]) {
    await this.board.surface.evaluate((element, events) => {
      const box = element.getBoundingClientRect();

      for (const contact of events) {
        const ending =
          contact.type === "pointerup" || contact.type === "pointercancel";

        element.dispatchEvent(
          new PointerEvent(contact.type, {
            bubbles: true,
            cancelable: true,
            pointerId: contact.id,
            pointerType: contact.pen ? "pen" : "touch",
            isPrimary: !contact.secondary,
            button: contact.type === "pointermove" ? -1 : 0,
            buttons: ending ? 0 : 1,
            clientX: box.left + contact.x,
            clientY: box.top + contact.y,
            pressure: contact.pressure ?? (ending ? 0 : 0.5),
          }),
        );
      }
    }, contacts);
  }

  private async viewport() {
    return (await this.board.storage.records()).main!.viewport;
  }

  private async expectViewport(expected: {
    x: number;
    y: number;
    zoom: number;
  }) {
    await expect.poll(() => this.viewport()).toEqual(expected);
  }

  private async fingersEnabled() {
    await this.page.getByRole("button", { name: "Перо", exact: true }).tap();

    await this.page
      .getByRole("checkbox", { name: "Рисовать пальцем", exact: true })
      .check();

    await this.page
      .getByRole("button", { name: "Закрыть параметры пера", exact: true })
      .tap();
  }

  async expectNavigationAndRebase() {
    const initial = await this.viewport();
    const box = (await this.board.surface.boundingBox())!;

    await this.page.touchscreen.tap(box.x + 300, box.y + 500);
    await this.board.storage.expectStrokeCount(0);

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointermove", id: 31, x: 360, y: 540 },
      { type: "pointerup", id: 31, x: 360, y: 540 },
    ]);

    const panned = { ...initial, x: initial.x + 60, y: initial.y + 40 };

    await this.expectViewport(panned);

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointerdown", id: 32, x: 500, y: 500, secondary: true },
      { type: "pointermove", id: 31, x: 240, y: 500 },
      { type: "pointermove", id: 32, x: 560, y: 500, secondary: true },
      { type: "pointerup", id: 32, x: 560, y: 500, secondary: true },
      { type: "pointermove", id: 31, x: 270, y: 520 },
      { type: "pointerup", id: 31, x: 270, y: 520 },
    ]);

    await expect
      .poll(async () => (await this.viewport()).zoom)
      .toBeCloseTo(initial.zoom * 1.6, 5);

    const actual = await this.viewport();

    expect(actual.x).toBeCloseTo(
      400 - ((400 - panned.x) / panned.zoom) * actual.zoom + 30,
      5,
    );

    expect(actual.y).toBeCloseTo(
      500 - ((500 - panned.y) / panned.zoom) * actual.zoom + 20,
      5,
    );

    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectPenPriorityAndQuarantine() {
    const initial = await this.viewport();

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointerdown", id: 41, x: 340, y: 520, pen: true, pressure: 0.2 },
      { type: "pointermove", id: 31, x: 450, y: 600 },
      { type: "pointermove", id: 41, x: 400, y: 520, pen: true, pressure: 0.9 },
      { type: "pointerdown", id: 32, x: 500, y: 600, secondary: true },
      { type: "pointermove", id: 41, x: 450, y: 540, pen: true },
      { type: "pointerup", id: 41, x: 450, y: 540, pen: true },
      { type: "pointermove", id: 31, x: 600, y: 700 },
      { type: "pointerup", id: 31, x: 600, y: 700 },
      { type: "pointerup", id: 32, x: 500, y: 600, secondary: true },
    ]);

    await this.board.storage.expectStrokeCount(1);
    await this.expectViewport(initial);

    const ink = (await this.board.storage.records()).main!.items[0]!;

    if (ink.kind !== "ink") throw new Error("Expected a pen stroke");

    expect(ink.points[0]!.pressure).toBeCloseTo(0.2, 5);

    expect(
      ink.points.some((point) => Math.abs(point.pressure - 0.9) < 0.00001),
    ).toBe(true);

    expect(ink.points.at(-1)!.x).toBeCloseTo(
      (450 - initial.x) / initial.zoom,
      5,
    );

    await this.stream([
      { type: "pointerdown", id: 33, x: 400, y: 600 },
      { type: "pointermove", id: 33, x: 430, y: 620 },
      { type: "pointerup", id: 33, x: 430, y: 620 },
    ]);

    await this.expectViewport({
      ...initial,
      x: initial.x + 30,
      y: initial.y + 20,
    });
  }

  async expectFingerEditingAndPinchCancellation() {
    await this.fingersEnabled();

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointermove", id: 31, x: 350, y: 510 },
      { type: "pointermove", id: 31, x: 400, y: 530 },
      { type: "pointerup", id: 31, x: 400, y: 530 },
    ]);

    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!.items;

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 600 },
      { type: "pointermove", id: 31, x: 340, y: 620 },
      { type: "pointerdown", id: 32, x: 480, y: 620, secondary: true },
      { type: "pointermove", id: 31, x: 280, y: 620 },
      { type: "pointermove", id: 32, x: 540, y: 620, secondary: true },
      { type: "pointerup", id: 31, x: 280, y: 620 },
      { type: "pointerup", id: 32, x: 540, y: 620, secondary: true },
    ]);

    await this.board.storage.expectScene(original);
    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectScene(original);
    await this.board.reopenSavedBoard();
    await this.page.getByRole("button", { name: "Перо", exact: true }).tap();

    await expect(
      this.page.getByRole("checkbox", {
        name: "Рисовать пальцем",
        exact: true,
      }),
    ).not.toBeChecked();
  }

  async expectCancelAndRotation() {
    await this.stream([
      { type: "pointerdown", id: 41, x: 300, y: 500, pen: true },
      { type: "pointermove", id: 41, x: 400, y: 540, pen: true },
      { type: "pointercancel", id: 41, x: 400, y: 540, pen: true },
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointermove", id: 31, x: 380, y: 540 },
    ]);

    await this.board.storage.expectSaved();
    await expect.poll(async () => (await this.viewport()).x).toBe(80);

    const panned = await this.viewport();

    await this.page.setViewportSize({ width: 1112, height: 834 });
    await expect(this.board.surface).toHaveJSProperty("clientWidth", 1112);

    await this.stream([
      { type: "pointermove", id: 31, x: 600, y: 600 },
      { type: "pointerup", id: 31, x: 600, y: 600 },
    ]);

    await this.expectViewport(panned);
    await this.board.storage.expectStrokeCount(0);
    await this.board.expectUndoUnavailable();
  }

  async expectReadOnlyNavigation() {
    const initial = await this.viewport();

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointerdown", id: 32, x: 500, y: 500, secondary: true },
      { type: "pointermove", id: 31, x: 240, y: 500 },
      { type: "pointermove", id: 32, x: 560, y: 500, secondary: true },
      { type: "pointerup", id: 31, x: 240, y: 500 },
      { type: "pointerup", id: 32, x: 560, y: 500, secondary: true },
      { type: "pointerdown", id: 41, x: 300, y: 600, pen: true },
      { type: "pointermove", id: 41, x: 400, y: 620, pen: true },
      { type: "pointerup", id: 41, x: 400, y: 620, pen: true },
    ]);

    await expect(
      this.page.getByRole("button", { name: /Масштаб 160 процентов/ }),
    ).toBeVisible();

    expect(await this.viewport()).toEqual(initial);

    await expect
      .poll(async () => (await this.board.storage.records()).main!.items.length)
      .toBe(0);

    await this.board.storage.expectReadOnly();
    await this.board.expectUndoUnavailable();
  }

  async expectTouchSelectionResize() {
    await this.fingersEnabled();

    await this.page
      .getByRole("button", { name: "Фигуры и заготовки", exact: true })
      .tap();

    await this.page
      .getByRole("button", { name: "Прямоугольник", exact: true })
      .tap();

    await this.page
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .tap();

    const box = (await this.board.surface.boundingBox())!;

    await this.page.touchscreen.tap(box.x + 400, box.y + 600);
    await this.board.storage.expectStrokeCount(1);

    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .tap();

    const original = (await this.board.storage.records()).main!.items[0]!;
    const handles = this.page.getByTestId("selection-handles");

    await expect(handles).not.toHaveAttribute("d", "");

    const path = (await handles.getAttribute("d"))!;

    const positions = [
      ...path.matchAll(/M(-?[\d.]+),(-?[\d.]+)h([\d.]+)v/g),
    ].map((match) => ({
      x: Number(match[1]) + Number(match[3]) / 2,
      y: Number(match[2]) + Number(match[3]) / 2,
    }));

    expect(positions.length).toBeGreaterThanOrEqual(4);

    const corner = positions.reduce((a, b) => (a.x + a.y > b.x + b.y ? a : b));

    await this.stream([
      { type: "pointerdown", id: 31, x: corner.x + 16, y: corner.y + 10 },
      { type: "pointermove", id: 31, x: corner.x + 86, y: corner.y + 55 },
      { type: "pointerup", id: 31, x: corner.x + 86, y: corner.y + 55 },
    ]);

    await expect
      .poll(
        async () => (await this.board.storage.records()).main!.items[0]!.matrix,
      )
      .not.toEqual(original.matrix);

    const resized = (await this.board.storage.records()).main!.items[0]!;

    if (original.kind !== "template" || resized.kind !== "template")
      throw new Error("Expected vector rectangle");

    expect(resized.template).toEqual(original.template);
    expect(resized.matrix[0]).toBeGreaterThan(original.matrix[0]);
    expect(resized.matrix[3]).toBeGreaterThan(original.matrix[3]);
    await this.board.undo();
    await this.board.storage.expectScene([original]);
    await this.board.redo();
    await this.board.storage.expectScene([resized]);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([resized]);
  }

  async expectFingerModeAcrossBoards(library: BoardLibraryPage) {
    await this.fingersEnabled();
    await library.create("Планшетные записи");
    await this.page.getByRole("button", { name: "Перо", exact: true }).tap();

    await expect(
      this.page.getByRole("checkbox", {
        name: "Рисовать пальцем",
        exact: true,
      }),
    ).toBeChecked();

    await this.page
      .getByRole("button", { name: "Закрыть параметры пера", exact: true })
      .tap();

    await this.board.reopenSavedBoard();
    await this.page.getByRole("button", { name: "Перо", exact: true }).tap();

    await expect(
      this.page.getByRole("checkbox", {
        name: "Рисовать пальцем",
        exact: true,
      }),
    ).not.toBeChecked();
  }

  async expectTemplateTouchPlacement() {
    await this.page
      .getByRole("button", { name: "Фигуры и заготовки", exact: true })
      .tap();

    await this.page
      .getByRole("button", { name: "Прямоугольник", exact: true })
      .tap();

    await this.page
      .getByRole("button", { name: "Разместить на доске", exact: true })
      .tap();

    await this.stream([
      { type: "pointerdown", id: 31, x: 300, y: 500 },
      { type: "pointerdown", id: 32, x: 500, y: 500, secondary: true },
      { type: "pointermove", id: 31, x: 240, y: 500 },
      { type: "pointermove", id: 32, x: 560, y: 500, secondary: true },
      { type: "pointerup", id: 31, x: 240, y: 500 },
      { type: "pointerup", id: 32, x: 560, y: 500, secondary: true },
    ]);

    await this.board.storage.expectStrokeCount(0);

    const box = (await this.board.surface.boundingBox())!;

    await this.page.touchscreen.tap(box.x + 400, box.y + 600);
    await this.board.storage.expectStrokeCount(1);

    const item = (await this.board.storage.records()).main!.items[0]!;

    expect(item.kind).toBe("template");
    await this.board.undo();
    await this.board.storage.expectStrokeCount(0);
    await this.board.redo();
    await this.board.storage.expectScene([item]);
  }
}
