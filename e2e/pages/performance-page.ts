import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { TestBoardTypes } from "../data/board.types";

export class PerformancePage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
  ) {}

  async monitorResources() {
    await this.page.addInitScript(() => {
      const state = {
        created: 0,
        terminated: 0,
        pointMessages: 0,
        maxPointValues: 0,
        maxMetadata: 0,
      };

      Object.defineProperty(window, "__performance40", { value: state });

      const NativeWorker = window.Worker;

      window.Worker = class extends NativeWorker {
        private closed = false;

        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          state.created++;
        }

        override postMessage(
          message: unknown,
          transferOrOptions?: Transferable[] | StructuredSerializeOptions,
        ) {
          const entry = message as {
            type?: string;
            values?: { length: number };
          };

          if (entry.type === "points") {
            state.pointMessages++;

            state.maxPointValues = Math.max(
              state.maxPointValues,
              entry.values?.length ?? 0,
            );
          }

          if (entry.type === "strokes")
            state.maxMetadata = Math.max(
              state.maxMetadata,
              entry.values?.length ?? 0,
            );

          if (Array.isArray(transferOrOptions))
            super.postMessage(message, transferOrOptions);
          else super.postMessage(message, transferOrOptions);
        }

        override terminate() {
          if (!this.closed) {
            state.terminated++;
            this.closed = true;
          }

          super.terminate();
        }
      };
    });

    await this.board.reopenSavedBoard();
  }

  private async resources() {
    return this.page.evaluate(() => {
      const state = (
        window as unknown as {
          __performance40: {
            created: number;
            terminated: number;
            pointMessages: number;
            maxPointValues: number;
            maxMetadata: number;
          };
        }
      ).__performance40;

      return { ...state, active: state.created - state.terminated };
    });
  }

  async expectLargeRoundtrip(document: TestBoardTypes.Document) {
    await this.board.storage.importDocument(document);

    const expected = (await this.board.storage.records()).main!;

    expect(expected.items[0]?.kind).toBe("ink");

    const ink = expected.items[0] as TestBoardTypes.InkItem;

    expect(ink.points).toEqual(document.strokes[0]!.points);

    const before = await this.resources();

    for (let i = 0; i < 3; i++) {
      const exported = await this.board.storage.exportDocument();

      expect(exported).toEqual(expected);

      await expect
        .poll(async () => (await this.resources()).active)
        .toBe(before.active);
    }

    const after = await this.resources();

    expect(after.created).toBeGreaterThan(before.created);
    expect(after.pointMessages).toBeGreaterThan(0);
    expect(after.maxPointValues).toBeLessThanOrEqual(2048 * 4);
    expect(after.maxMetadata).toBeLessThanOrEqual(64);
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(expected.items);
  }
}
