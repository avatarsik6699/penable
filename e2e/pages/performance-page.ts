import { expect, type Page } from "@playwright/test";
import type { BoardPage } from "./board-page";
import type { TestBoardTypes } from "../data/board.types";
import { createHash } from "node:crypto";

export class PerformancePage {
  constructor(
    private readonly page: Page,
    private readonly board: BoardPage,
    private readonly releaseReplacementFailure?: () => Promise<void>,
    private readonly retainedHeap?: () => Promise<number>,
  ) {}

  async monitorResources() {
    await this.page.addInitScript(() => {
      const state = {
        created: 0,
        terminated: 0,
        pointMessages: 0,
        maxPointValues: 0,
        maxMetadata: 0,
        maximumOutstanding: 0,
      };

      Object.defineProperty(window, "__performance40", { value: state });

      const retired: WeakRef<Worker>[] = [];

      Object.defineProperty(window, "__terminatedWorkers42", {
        value: retired,
      });

      const NativeWorker = window.Worker;

      window.Worker = class extends NativeWorker {
        private closed = false;
        private readonly pending = new Set<string>();

        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);
          state.created++;

          this.addEventListener("message", ({ data }) => {
            const ack = data.ack ?? (data.type === "ack" ? data.seq : null);

            if (Number.isInteger(ack)) this.pending.delete(`${data.id}:${ack}`);
          });
        }

        override postMessage(
          message: unknown,
          transferOrOptions?: Transferable[] | StructuredSerializeOptions,
        ) {
          const entry = message as {
            type?: string;
            values?: { length: number };
            id?: number;
            seq?: number;
          };

          if (entry.type === "points" || entry.type === "points-batch") {
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

          if (Number.isInteger(entry.seq) && entry.type !== "ack") {
            this.pending.add(`${entry.id}:${entry.seq}`);

            state.maximumOutstanding = Math.max(
              state.maximumOutstanding,
              this.pending.size,
            );
          }

          if (Array.isArray(transferOrOptions))
            super.postMessage(message, transferOrOptions);
          else super.postMessage(message, transferOrOptions);
        }

        override terminate() {
          if (!this.closed) {
            state.terminated++;
            this.closed = true;
            retired.push(new WeakRef(this));
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
            maximumOutstanding: number;
          };
        }
      ).__performance40;

      return { ...state, active: state.created - state.terminated };
    });
  }

  private async expectRetiredWorkersCollected() {
    await expect
      .poll(async () => {
        await this.page.requestGC();

        return this.page.evaluate(() => {
          const retired = (
            window as unknown as { __terminatedWorkers42: WeakRef<Worker>[] }
          ).__terminatedWorkers42;

          return retired.filter((worker) => worker.deref()).length;
        });
      })
      .toBe(0);
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
    await this.expectRetiredWorkersCollected();
    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(expected.items);
  }

  async expectPackedMillionRoundtrip(document: TestBoardTypes.Document) {
    const beforeHeap = await this.retainedHeap?.();

    await this.board.storage.importDocument(document);
    await this.board.storage.expectScene(document.strokes);

    const before = await this.resources();
    const exported = await this.board.storage.exportDocument();
    const after = await this.resources();

    expect(exported.items).toHaveLength(20000);

    expect(exported.items.every((item) => item.kind === "ink")).toBe(true);

    const pointDigest = (
      items: Array<TestBoardTypes.Stroke | TestBoardTypes.Item>,
    ) => {
      const hash = createHash("sha256");

      for (const item of items) {
        const points = "points" in item ? item.points : [];

        hash.update(
          JSON.stringify([
            item.id,
            points.map((point) => [
              point.x,
              point.y,
              point.pressure,
              point.time,
            ]),
          ]),
        );
      }

      return hash.digest("hex");
    };

    expect(pointDigest(exported.items)).toBe(pointDigest(document.strokes));

    expect(after.pointMessages - before.pointMessages).toBe(489);
    expect(after.maxPointValues).toBeLessThanOrEqual(2048 * 4);
    expect(after.maxMetadata).toBeLessThanOrEqual(64);
    expect(after.maximumOutstanding).toBeGreaterThan(0);
    expect(after.maximumOutstanding).toBeLessThanOrEqual(2);

    await expect
      .poll(async () => (await this.resources()).active)
      .toBe(before.active);

    await this.expectRetiredWorkersCollected();

    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene(exported.items);
    await this.board.storage.importDocument({ ...document, strokes: [] });
    await this.board.storage.expectPreviousFingerprint(exported);

    const replacedHeap = await this.retainedHeap?.();

    if (beforeHeap !== undefined && replacedHeap !== undefined)
      expect(
        replacedHeap - beforeHeap,
        "Release the old million-point UI graph after replacement",
      ).toBeLessThan(16 * 1024 * 1024);

    await this.board.reopenSavedBoard();
    await this.board.storage.expectScene([]);
    await this.board.storage.expectPreviousFingerprint(exported);

    const afterHeap = await this.retainedHeap?.();

    if (beforeHeap !== undefined && afterHeap !== undefined)
      expect(
        afterHeap - beforeHeap,
        "Release the old million-point UI graph after replacement and reload",
      ).toBeLessThan(16 * 1024 * 1024);
  }

  async expectAtomicReplacementRetry(document: TestBoardTypes.Document) {
    await this.board.storage.importDocument(document);

    const before = await this.board.storage.records();

    await this.board.storage.beginImport();

    const dialog = this.page.getByRole("dialog", {
      name: "Импорт доски",
      exact: true,
    });

    await dialog.locator("input[type=file]").setInputFiles({
      name: "retry-candidate.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({ ...document, background: "grid" })),
    });

    const confirm = dialog.getByRole("button", {
      name: "Заменить доску",
      exact: true,
    });

    await expect(confirm).toBeEnabled();

    await this.page.evaluate(() => {
      (
        window as unknown as { __replacementFault42: (value: boolean) => void }
      ).__replacementFault42(true);
    });

    await confirm.click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    await expect(confirm).toBeEnabled();
    expect(await this.board.storage.records()).toEqual(before);

    const reads = await this.page.evaluate(
      () =>
        (window as unknown as { __candidateReads42: number })
          .__candidateReads42,
    );

    await this.releaseReplacementFailure?.();
    await confirm.click();
    await expect(dialog).toBeHidden();
    await this.board.storage.expectSaved();

    expect(
      await this.page.evaluate(
        () =>
          (window as unknown as { __candidateReads42: number })
            .__candidateReads42,
      ),
    ).toBe(reads);

    const after = await this.board.storage.records();

    expect(after.main?.background).toBe("grid");
    expect(after.main?.items).toEqual(before.main?.items);
    expect(after.previous).toEqual(before.main);
    await this.board.storage.closeDetails();
    await this.board.reopenSavedBoard();
    expect((await this.board.storage.records()).main).toEqual(after.main);
    await this.board.storage.expectRecovery("previous", before.main!);
  }
}
