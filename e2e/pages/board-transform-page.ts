import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";

export class BoardTransformPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async all() {
    await this.page
      .getByRole("button", { name: "Выделение", exact: true })
      .click();

    await this.board.surface.focus();
    await this.page.keyboard.press("Control+a");

    await expect(
      this.page.getByRole("button", { name: "Действия", exact: true }),
    ).toBeEnabled();
  }

  async numeric(width: number, height: number, angle: number) {
    const actions = this.page.getByRole("button", {
      name: "Действия",
      exact: true,
    });

    if ((await actions.getAttribute("aria-expanded")) !== "true")
      await actions.click();

    await this.page
      .getByRole("button", { name: "Преобразовать", exact: true })
      .click();

    await this.page
      .getByRole("spinbutton", { name: "Ширина, %", exact: true })
      .fill(String(width));

    await this.page
      .getByRole("spinbutton", { name: "Высота, %", exact: true })
      .fill(String(height));

    await this.page
      .getByRole("spinbutton", { name: "Угол, °", exact: true })
      .fill(String(angle));

    await this.page
      .getByRole("button", { name: "Применить преобразование", exact: true })
      .click();

    await this.board.storage.expectSaved();
    await this.page.keyboard.press("Escape");
  }

  async expectNumericTransformRoundtrip() {
    await this.board.drawStroke();
    await this.board.storage.expectStrokeCount(1);

    const original = (await this.board.storage.records()).main!;

    await this.all();
    await this.numeric(175, 125, 30);

    await expect
      .poll(async () => (await this.board.storage.records()).main!.items)
      .not.toEqual(original.items);

    const transformed = (await this.board.storage.records()).main!;

    const before = original.items[0]!,
      after = transformed.items[0]!;

    if (before.kind !== "ink" || after.kind !== "ink")
      throw new Error("Transform fixture must contain ink");

    expect(after.points).toEqual(before.points);
    expect(after.width).toBe(before.width);
    expect(after.stabilization).toEqual(before.stabilization);
    expect(after.matrix).not.toEqual(before.matrix);
    await this.board.undo();
    await this.board.storage.expectScene(original.items);
    await this.board.redo();
    await this.board.storage.expectScene(transformed.items);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(transformed.items);
    await this.board.storage.expectExportMatchesSaved();
  }

  async expectPointerResizeAndCancel() {
    await this.board.drawStroke({ x: 260, y: 280 }, { x: 400, y: 340 });
    await this.board.storage.expectStrokeCount(1);
    await this.board.selectRectangle({ x: 200, y: 220 }, { x: 500, y: 420 });

    const original = (await this.board.storage.records()).main!.items;
    const box = (await this.board.surface.boundingBox())!;

    await this.page.keyboard.down("Shift");
    await this.page.mouse.move(box.x + 500, box.y + 420);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 620, box.y + 500, { steps: 12 });
    await this.page.mouse.up();
    await this.page.keyboard.up("Shift");

    await expect
      .poll(async () => (await this.board.storage.records()).main!.items)
      .not.toEqual(original);

    const resized = (await this.board.storage.records()).main!.items;
    const ink = resized[0]!;

    expect(ink.matrix[0]).toBeCloseTo(ink.matrix[3], 5);
    expect(ink.matrix[0]).toBeGreaterThan(1);
    await this.page.mouse.move(box.x + 300, box.y + 300);
    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 360, box.y + 320, { steps: 6 });
    await this.page.keyboard.press("Escape");
    await this.page.mouse.up();
    await this.board.storage.expectScene(resized);
    await this.board.undo();
    await this.board.storage.expectScene(original);
  }

  async expectPointerRotation() {
    await this.board.drawStroke({ x: 260, y: 280 }, { x: 400, y: 340 });
    await this.board.storage.expectStrokeCount(1);
    await this.board.selectRectangle({ x: 200, y: 220 }, { x: 500, y: 420 });

    const original = (await this.board.storage.records()).main!.items;
    const handles = this.page.getByTestId("selection-handles");

    await expect(handles).not.toHaveAttribute("d", "");

    const path = (await handles.getAttribute("d"))!;
    const start = path.match(/M(-?[\d.]+),(-?[\d.]+)a5/);

    expect(start, "Rotation handle must be rendered").toBeTruthy();

    const box = (await this.board.surface.boundingBox())!;

    await this.page.keyboard.down("Shift");

    await this.page.mouse.move(
      box.x + Number(start![1]) + 5,
      box.y + Number(start![2]),
    );

    await this.page.mouse.down();
    await this.page.mouse.move(box.x + 500, box.y + 320, { steps: 16 });
    await this.page.mouse.up();
    await this.page.keyboard.up("Shift");

    await expect
      .poll(async () => (await this.board.storage.records()).main!.items)
      .not.toEqual(original);

    const item = (await this.board.storage.records()).main!.items[0]!;

    expect(item.matrix[0]).toBeCloseTo(0, 5);
    expect(item.matrix[1]).toBeCloseTo(1, 5);
    expect(item.matrix[2]).toBeCloseTo(-1, 5);
    expect(item.matrix[3]).toBeCloseTo(0, 5);
    await this.board.undo();
    await this.board.storage.expectScene(original);
  }
}
