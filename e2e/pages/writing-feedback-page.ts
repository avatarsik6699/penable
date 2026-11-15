import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";

export class WritingFeedbackPage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  private async pen(
    phase: "down" | "move" | "up" | "lift" | "hover" | "leave",
    anomalous = false,
  ) {
    await this.board.surface.evaluate(
      (canvas, input) => {
        const bounds = canvas.getBoundingClientRect();

        const x =
          input.phase === "down" ? 150 : input.phase === "hover" ? 240 : 220;

        const y =
          input.phase === "down" ? 260 : input.phase === "hover" ? 300 : 280;

        const released = ["up", "lift", "hover", "leave"].includes(input.phase);

        const type =
          input.phase === "down"
            ? "pointerdown"
            : input.phase === "up"
              ? "pointerup"
              : input.phase === "leave"
                ? "pointerleave"
                : "pointermove";

        const init = {
          pointerId: 47,
          pointerType: "pen",
          isPrimary: true,
          button: 0,
          buttons: released ? 0 : 1,
          pressure: released ? 0 : 0.5,
          clientX: bounds.left + (input.anomalous ? 600 : x),
          clientY: bounds.top + (input.anomalous ? 450 : y),
          bubbles: true,
          cancelable: true,
        };

        const event = new PointerEvent(type, init);

        if (input.phase === "up" && input.anomalous) {
          // Model disagreement between a terminal wrapper and its captured ink sample.
          // This fixture reproduces the presentation path, not a particular Wacom driver.
          Object.defineProperty(event, "getCoalescedEvents", {
            value: () => [
              new PointerEvent("pointermove", {
                ...init,
                clientX: bounds.left + 220,
                clientY: bounds.top + 280,
              }),
            ],
          });
        }

        canvas.dispatchEvent(event);
      },
      { phase, anomalous },
    );
  }

  private cursor() {
    return this.page.getByTestId("board-cursor").evaluate((element) => {
      const matrix = new DOMMatrix((element as HTMLElement).style.transform);

      return {
        x: matrix.m41,
        y: matrix.m42,
        visible: !(element as HTMLElement).hidden,
      };
    });
  }

  async expectStablePenLift() {
    await this.pen("down");
    await this.pen("move");

    await expect
      .poll(() => this.cursor())
      .toEqual({ x: 220, y: 280, visible: true });

    await this.pen("up", true);
    await this.board.storage.expectStrokeCount(1);

    await expect
      .poll(() => this.cursor())
      .toEqual({ x: 220, y: 280, visible: true });

    const item = (await this.board.storage.records()).main!.items[0]!;

    expect(item.kind).toBe("ink");

    if (item.kind !== "ink")
      throw new Error("Expected the completed pen stroke");

    expect(item.points.at(-1)!.x).toBe(220);
    expect(item.points.at(-1)!.y).toBe(280);
    await this.pen("leave", true);

    await expect
      .poll(() => this.cursor())
      .toEqual({ x: 220, y: 280, visible: true });

    await this.pen("hover");

    await expect
      .poll(() => this.cursor())
      .toEqual({ x: 240, y: 300, visible: true });
  }

  private async styles() {
    const names = [
      "Доски",
      "Вставить изображение",
      "Фигуры и заготовки",
      "Перо",
      "Ластик",
      "Выделение",
      "Отменить действие",
      "Вернуть действие",
    ];

    return Promise.all(
      names.map((name) =>
        this.page
          .getByRole("button", { name, exact: true })
          .evaluate((button) => {
            const style = getComputedStyle(button);
            const icon = button.querySelector("svg");

            return {
              color: style.color,
              background: style.backgroundColor,
              opacity: style.opacity,
              icon: icon ? getComputedStyle(icon).color : null,
            };
          }),
      ),
    );
  }

  async expectCalmRepeatedWriting() {
    await this.board.drawStroke();

    const dock = this.page.getByRole("group", {
      name: "Инструменты доски",
      exact: true,
    });

    await dock.evaluate(async (root) => {
      await Promise.all(
        root
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });

    await this.page.getByRole("button", { name: "Перо", exact: true }).hover();

    await dock.evaluate(async (root) => {
      await Promise.all(
        root
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });

    const baseline = await this.styles();

    const bounds = await dock.boundingBox();

    for (let stroke = 0; stroke < 5; stroke++) {
      await this.pen("down");
      await this.pen("move");

      await expect(
        this.page.getByRole("button", { name: "Перо", exact: true }),
      ).toBeDisabled();

      await this.page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );

      expect(await this.styles()).toEqual(baseline);
      expect(await dock.boundingBox()).toEqual(bounds);

      await this.page
        .getByRole("button", { name: "Ластик", exact: true })
        .evaluate((button) => (button as HTMLButtonElement).click());

      await this.page
        .getByRole("button", { name: "Доски", exact: true })
        .evaluate((button) => (button as HTMLButtonElement).click());

      await this.page.keyboard.press("Control+z");

      await expect(
        this.page.getByRole("button", { name: "Перо", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");

      await expect(
        this.page.getByRole("button", { name: "Доски", exact: true }),
      ).toHaveAttribute("aria-expanded", "false");

      await this.board.storage.expectStrokeCount(stroke + 1);
      await this.pen("up");
      await this.board.storage.expectStrokeCount(stroke + 2);

      await expect(
        this.page.getByRole("button", { name: "Перо", exact: true }),
      ).toBeEnabled();

      expect(await this.styles()).toEqual(baseline);
    }

    await this.board.reopenSavedBoard();
    await this.board.storage.expectStrokeCount(6);
    await this.board.drawStroke();
    await this.board.undo();
    await this.board.storage.expectStrokeCount(6);

    await expect(
      this.page.getByRole("button", { name: "Вернуть действие", exact: true }),
    ).toBeEnabled();
  }

  async expectReadOnlyStaysMuted() {
    const pen = this.page.getByRole("button", { name: "Перо", exact: true });

    const redo = this.page.getByRole("button", {
      name: "Вернуть действие",
      exact: true,
    });

    await expect(pen).toBeDisabled();
    await expect(redo).toBeDisabled();

    expect(
      await pen.evaluate((element) => getComputedStyle(element).color),
    ).toBe(await redo.evaluate((element) => getComputedStyle(element).color));

    await pen.evaluate((element) => (element as HTMLButtonElement).click());
    await this.board.tryDrawingReadOnly();

    await expect
      .poll(
        async () =>
          (await this.board.storage.records()).main?.items.length ?? 0,
      )
      .toBe(0);
  }
}
