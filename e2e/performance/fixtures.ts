import { test as base } from "../fixtures";
import { PerformancePage } from "../pages/performance-page";
import { performanceBoards } from "../data/performance-boards";
import type { TestBoardTypes } from "../data/board.types";
import { BoardPage } from "../pages/board-page";
import { StoragePage } from "../pages/storage-page";
import { expect } from "@playwright/test";
import { RecoveryCopiesPage } from "../pages/recovery-copies-page";
import { testBoards } from "../data/boards";

export const test = base.extend<{
  performance: PerformancePage;
  millionDocument: TestBoardTypes.Document;
  replacementFailure: PerformancePage;
  recoveryCopies: RecoveryCopiesPage;
}>({
  millionDocument: async ({ baseURL: _baseURL }, provide, testInfo) => {
    // Multiple full-limit roundtrips plus GC; per-action assertions keep their bounds.
    testInfo.setTimeout(90_000);

    await provide(performanceBoards.million());
  },

  performance: async ({ page, board }, provide, testInfo) => {
    const cdp = await page.context().newCDPSession(page);
    const samples: unknown[] = [];

    const heap = async () => {
      await page.requestGC();

      const sample = await cdp.send("Runtime.getHeapUsage");

      samples.push(sample);

      return sample.usedSize;
    };

    const performance = new PerformancePage(page, board, undefined, heap);

    try {
      await performance.monitorResources();
      await provide(performance);
    } finally {
      await testInfo.attach("main-ui-heap-after-gc", {
        body: JSON.stringify({ samples }),
        contentType: "application/json",
      });

      await cdp.detach();
    }
  },

  replacementFailure: async ({ page }, provide) => {
    const errors: string[] = [];

    const consoleMessage = (message: {
      type: () => string;
      text: () => string;
    }) => {
      if (["error", "warning"].includes(message.type()))
        errors.push(message.text());
    };

    const pageError = (error: Error) => errors.push(error.message);

    page.on("console", consoleMessage);
    page.on("pageerror", pageError);

    await page.addInitScript(() => {
      Reflect.deleteProperty(Navigator.prototype, "serviceWorker");

      const NativeWorker = window.Worker;
      const writers = new Set<Worker>();
      let active = false;
      let reads = 0;

      Object.defineProperty(window, "__replacementFault42", {
        value: (enabled: boolean) => {
          active = enabled;

          for (const worker of writers)
            worker.postMessage({ type: "test-replacement-abort-42", enabled });
        },
      });

      Object.defineProperty(window, "__candidateReads42", {
        get: () => reads,
      });

      window.Worker = class extends NativeWorker {
        constructor(url: string | URL, options?: WorkerOptions) {
          super(url, options);

          if (String(url).includes("/jobs-worker-")) {
            writers.add(this);

            super.postMessage({
              type: "test-replacement-abort-42",
              enabled: active,
            });
          }
        }

        override postMessage(
          message: unknown,
          options?: Transferable[] | StructuredSerializeOptions,
        ) {
          if ((message as { type?: string }).type === "file") reads++;

          if (Array.isArray(options)) super.postMessage(message, options);
          else super.postMessage(message, options);
        }

        override terminate() {
          writers.delete(this);
          super.terminate();
        }
      };
    });

    await page.route(/\/jobs-worker-[\w-]+\.js$/, async (route) => {
      const response = await route.fetch();

      const fault = `
        let abortReplacement42 = false;
        self.addEventListener("message", ({data}) => {
          if (data.type === "test-replacement-abort-42") abortReplacement42 = data.enabled;
        });
        const put42 = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(value, key) {
          const request = put42.call(this, value, key);
          if (abortReplacement42 && typeof key === "string" && key.endsWith("before-import"))
            this.transaction.abort();
          return request;
        };
      `;

      await route.fulfill({ response, body: fault + (await response.text()) });
    });

    const board = new BoardPage(page, new StoragePage(page));

    const release = () =>
      page.evaluate(() => {
        (
          window as unknown as {
            __replacementFault42: (value: boolean) => void;
          }
        ).__replacementFault42(false);
      });

    try {
      await board.open();
      await provide(new PerformancePage(page, board, release));
    } finally {
      page.off("console", consoleMessage);
      page.off("pageerror", pageError);
      expect(errors, "Unexpected runtime errors/warnings").toEqual([]);
    }
  },

  recoveryCopies: async ({ board, context }, provide) => {
    await board.storage.importDocument({
      ...testBoards.document(),
      background: "dots",
    });

    const captured = (await board.storage.records()).main!;

    await board.storage.importDocument(testBoards.legacy());

    const page = await context.newPage();
    const reader = new BoardPage(page, new StoragePage(page));
    const errors: string[] = [];

    const pageError = (error: Error) => errors.push(error.message);

    const consoleMessage = (message: {
      type: () => string;
      text: () => string;
    }) => {
      if (["warning", "error"].includes(message.type()))
        errors.push(message.text());
    };

    page.on("pageerror", pageError);
    page.on("console", consoleMessage);

    try {
      await page.goto("/penable/");
      await reader.storage.expectReadOnly();
      await provide(new RecoveryCopiesPage(page, reader, board, captured));
    } finally {
      page.off("pageerror", pageError);
      page.off("console", consoleMessage);
      await page.close();
      expect(errors, "Unexpected runtime errors/warnings").toEqual([]);
    }
  },
});
