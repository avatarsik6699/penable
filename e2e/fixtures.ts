import { test as base, expect, type Page } from "@playwright/test";
import { BoardTransformPage } from "./pages/board-transform-page";
import { BoardClipboardPage } from "./pages/board-clipboard-page";
import { BoardImagePage } from "./pages/board-image-page";
import { BoardLibraryPage } from "./pages/board-library-page";
import { testImageFiles, type TestImageTypes } from "./data/image-files";
import { BoardNavigationPage } from "./pages/board-navigation-page";
import { EditorChromePage } from "./pages/editor-chrome-page";
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

async function seedRecords(page: Page, records: Record<string, unknown>) {
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
    (values) =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("penable", 1);

        request.onupgradeneeded = () => {
          request.result.createObjectStore("documents");
        };

        request.onerror = () => reject(request.error);

        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("documents", "readwrite");

          for (const [key, value] of Object.entries(values))
            tx.objectStore("documents").put(value, key);

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
    records,
  );

  await page.unroute(url);
}

async function seedLegacy(page: Page, secondVersion = false) {
  await seedRecords(page, {
    main: secondVersion ? testBoards.previousV2() : testBoards.legacy(),
    "before-import": testBoards.previous(),
    ...(secondVersion ? { "before-schema2": testBoards.legacy() } : {}),
  });
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
  clipboardAccess: void;
  clipboard: BoardClipboardPage;
  clipboardFailure: BoardClipboardPage;
  transforms: BoardTransformPage;
  images: TestImageTypes.Files;
  imageBoard: BoardImagePage;
  library: BoardLibraryPage;
  failedSwitch: { library: BoardLibraryPage; release: () => Promise<void> };
  documents: {
    empty: TestBoardTypes.Document;
    heavy: TestBoardTypes.Document;
    legacy: TestBoardTypes.Document;
    previous: TestBoardTypes.Document;
    v2: TestBoardTypes.Document;
    v3: TestBoardTypes.Document;
    corrupt: unknown;
    missingCatalog: TestBoardTypes.Catalog;
    distant: TestBoardTypes.Document;
  };
  samples: Samples;
  board: BoardPage;
  editor: EditorChromePage;
  navigation: BoardNavigationPage;
  overviewFailureNavigation: BoardNavigationPage;
  secondBoard: BoardPage;
  legacyBoard: BoardPage;
  v2Board: BoardPage;
  v3Board: BoardPage;
  corruptStorage: StoragePage;
  missingBoardStorage: StoragePage;
  saveFailureBoard: BoardPage;
};

export const test = base.extend<Fixtures>({
  clipboardAccess: [
    async ({ context }, use) => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"], {
        origin: "http://127.0.0.1:4185",
      });

      await use();
    },
    { auto: true },
  ],

  clipboard: async ({ page, board }, use) => {
    await use(new BoardClipboardPage(page, board));
  },

  clipboardFailure: async ({ page }, use) => {
    await page.addInitScript(() => {
      const native = navigator.clipboard;

      let mode = "none";

      Object.defineProperty(window, "__clipboardFault18", {
        get: () => mode,

        set: (next: string) => {
          mode = next;
        },
      });

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        get: () =>
          mode === "unavailable"
            ? undefined
            : {
                read: () =>
                  mode === "read-denied"
                    ? Promise.reject(
                        new DOMException("Test read denied", "NotAllowedError"),
                      )
                    : native.read(),
                write: (items: ClipboardItem[]) =>
                  mode === "write-denied"
                    ? Promise.reject(
                        new DOMException(
                          "Test write denied",
                          "NotAllowedError",
                        ),
                      )
                    : native.write(items),
                writeText: (value: string) => native.writeText(value),
                readText: () => native.readText(),
              },
      });
    });

    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await board.open();
      await use(new BoardClipboardPage(page, board));
    } finally {
      verify();
    }
  },

  transforms: async ({ page, board }, use) => {
    await use(new BoardTransformPage(page, board));
  },

  images: async ({ baseURL: _baseURL }, use) => {
    await use(await testImageFiles.files());
  },

  imageBoard: async ({ page, board }, use) => {
    await use(new BoardImagePage(page, board));
  },

  library: async ({ page, board }, use) => {
    await use(new BoardLibraryPage(page, board));
  },

  failedSwitch: async ({ page }, use) => {
    let active = true,
      blocked = 0;

    const verify = monitor(page, () => active);
    const board = new BoardPage(page, new StoragePage(page));
    const library = new BoardLibraryPage(page, board);
    const worker = /\/assets\/[^/]*worker[^/]*\.js$/i;

    await board.open();
    await library.prepareFailureTarget();

    await page.route(worker, (route) => {
      blocked++;

      return route.abort("failed");
    });

    const release = async () => {
      expect(
        blocked,
        "The actual board save worker must have failed",
      ).toBeGreaterThan(0);

      await page.unroute(worker);
      active = false;
    };

    try {
      await use({ library, release });
    } finally {
      await page.unroute(worker);
      verify();
    }
  },

  navigation: async ({ page, board }, use) => {
    await use(new BoardNavigationPage(page, board));
  },

  editor: async ({ page, board }, use) => {
    await use(new EditorChromePage(page, board));
  },

  documents: async ({ baseURL: _baseURL }, use) => {
    await use({
      empty: testBoards.document(),
      heavy: testBoards.heavy(),
      legacy: testBoards.legacy(),
      previous: testBoards.previous(),
      v2: testBoards.previousV2(),
      v3: testBoards.previousV3(),
      corrupt: testBoards.corrupt(),
      missingCatalog: testBoards.catalogWithMissingBoard(),
      distant: testBoards.distant(),
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

  v2Board: async ({ page }, use) => {
    const verify = monitor(page);

    await seedLegacy(page, true);

    const board = new BoardPage(page, new StoragePage(page));

    try {
      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },

  v3Board: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, {
        main: testBoards.previousV3(),
        "before-import": testBoards.previous(),
        "before-schema2": testBoards.legacy(),
        "before-schema3": testBoards.previousV2(),
      });

      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },

  corruptStorage: async ({ page }, use) => {
    const verify = monitor(page),
      storage = new StoragePage(page);

    try {
      await seedRecords(page, { main: testBoards.corrupt() });
      await page.goto("/penable/");
      await storage.expectSaveError();
      await use(storage);
    } finally {
      verify();
    }
  },

  missingBoardStorage: async ({ page }, use) => {
    const verify = monitor(page),
      storage = new StoragePage(page);

    try {
      await seedRecords(page, {
        library: testBoards.catalogWithMissingBoard(),
      });

      await page.goto("/penable/");
      await storage.expectSaveError();
      await use(storage);
    } finally {
      verify();
    }
  },

  overviewFailureNavigation: async ({ page }, use) => {
    let active = true,
      blocked = 0;

    const verify = monitor(page, () => active);
    const worker = /\/assets\/[^/]*worker[^/]*\.js$/i;
    const board = new BoardPage(page, new StoragePage(page));

    await board.open();
    await board.drawStroke();

    await page.route(worker, (route) => {
      blocked++;

      return route.abort("failed");
    });

    const release = async () => {
      expect(
        blocked,
        "Actual overview worker must have failed",
      ).toBeGreaterThan(0);

      await page.unroute(worker);
      active = false;
    };

    try {
      await use(new BoardNavigationPage(page, board, release));
    } finally {
      await page.unroute(worker);
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
