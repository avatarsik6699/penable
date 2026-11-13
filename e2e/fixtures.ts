import { test as base, expect, type Page } from "@playwright/test";
import { BoardPage } from "./pages/board-page";
import { StoragePage } from "./pages/storage-page";
import { testBoards } from "./data/boards";
import type { TestBoardTypes } from "./data/board.types";

function monitor(
  page: Page,
  expectedWorkerFailure: () => boolean = () => false,
) {
  const unexpected: string[] = [];
  const consoleMessage = (message: {
    type: () => string;
    text: () => string;
    location: () => { url: string };
  }) => {
    if (!["error", "warning"].includes(message.type())) return;
    if (
      expectedWorkerFailure() &&
      /\/assets\/.*worker.*\.js/i.test(message.location().url) &&
      /Failed to load resource.*ERR_FAILED/.test(message.text())
    )
      return;
    unexpected.push(message.text());
  };
  const pageError = (error: Error) => {
    unexpected.push(error.message);
  };
  page.on("console", consoleMessage);
  page.on("pageerror", pageError);
  return () => {
    page.off("console", consoleMessage);
    page.off("pageerror", pageError);
    expect(unexpected, "Unexpected runtime errors/warnings").toEqual([]);
  };
}

async function seedLegacy(page: Page) {
  const url = "http://127.0.0.1:4185/__e2e_seed";
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!doctype html><title>Owned test seed</title>",
    }),
  );
  await page.goto(url);
  await page.evaluate(
    ({ main, previous }) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("penable", 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore("documents");
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("documents", "readwrite");
          tx.objectStore("documents").put(main, "main");
          tx.objectStore("documents").put(previous, "before-import");
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onabort = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
    { main: testBoards.legacy(), previous: testBoards.previous() },
  );
  await page.unroute(url);
}

type Samples = {
  selectionStart: TestBoardTypes.Position;
  selectionEnd: TestBoardTypes.Position;
  moveStart: TestBoardTypes.Position;
  moveEnd: TestBoardTypes.Position;
  eraseStart: TestBoardTypes.Position;
  eraseEnd: TestBoardTypes.Position;
  extraStart: TestBoardTypes.Position;
  extraEnd: TestBoardTypes.Position;
};
type Fixtures = {
  documents: {
    empty: TestBoardTypes.Document;
    heavy: TestBoardTypes.Document;
    legacy: TestBoardTypes.Document;
    previous: TestBoardTypes.Document;
  };
  samples: Samples;
  board: BoardPage;
  secondBoard: BoardPage;
  legacyBoard: BoardPage;
  saveFailureBoard: BoardPage;
};
export const test = base.extend<Fixtures>({
  documents: async ({ baseURL: _baseURL }, use) => {
    await use({
      empty: testBoards.document(),
      heavy: testBoards.heavy(),
      legacy: testBoards.legacy(),
      previous: testBoards.previous(),
    });
  },
  samples: async ({ baseURL: _baseURL }, use) => {
    await use({
      selectionStart: { x: 130, y: 80 },
      selectionEnd: { x: 260, y: 200 },
      moveStart: { x: 180, y: 130 },
      moveEnd: { x: 220, y: 160 },
      eraseStart: { x: 180, y: 112 },
      eraseEnd: { x: 220, y: 125 },
      extraStart: { x: 300, y: 200 },
      extraEnd: { x: 500, y: 240 },
    });
  },
  board: async ({ page }, use) => {
    const verify = monitor(page);
    const board = new BoardPage(page, new StoragePage(page));
    try {
      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },
  secondBoard: async ({ board: _board, context }, use) => {
    const page = await context.newPage(),
      verify = monitor(page);
    const board = new BoardPage(page, new StoragePage(page));
    try {
      await page.goto("/penable/");
      await board.storage.expectReadOnly();
      await use(board);
    } finally {
      verify();
      await page.close();
    }
  },
  legacyBoard: async ({ page }, use) => {
    const verify = monitor(page);
    const board = new BoardPage(page, new StoragePage(page));
    try {
      await seedLegacy(page);
      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },
  saveFailureBoard: async ({ page }, use) => {
    let active = true,
      blocked = 0;
    const verify = monitor(page, () => active);
    const worker = /\/assets\/[^/]*worker[^/]*\.js$/i;
    await page.route(worker, (route) => {
      blocked++;
      return route.abort("failed");
    });
    const release = async () => {
      expect(
        blocked,
        "The actual worker request must have failed",
      ).toBeGreaterThan(0);
      await page.unroute(worker);
      active = false;
    };
    const board = new BoardPage(page, new StoragePage(page), release);
    try {
      await board.open();
      await use(board);
    } finally {
      await page.unroute(worker);
      verify();
    }
  },
});
