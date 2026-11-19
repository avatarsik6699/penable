import { test as base, expect, type Page } from "@playwright/test";
import { BoardTransformPage } from "./pages/board-transform-page";
import { BoardClipboardPage } from "./pages/board-clipboard-page";
import { BoardImagePage } from "./pages/board-image-page";
import { BoardRecoveryPage } from "./pages/board-recovery-page";
import { BoardLibraryPage } from "./pages/board-library-page";
import { BoardAppearancePage } from "./pages/board-appearance-page";
import { appearanceBoards } from "./data/appearance-boards";
import { testImageFiles, type TestImageTypes } from "./data/image-files";
import { BoardNavigationPage } from "./pages/board-navigation-page";
import { EditorChromePage } from "./pages/editor-chrome-page";
import { BoardPage } from "./pages/board-page";
import { StoragePage } from "./pages/storage-page";
import { testBoards } from "./data/boards";
import type { TestBoardTypes } from "./data/board.types";
import { WritingToolsPage } from "./pages/writing-tools-page";
import { TemplatesPage } from "./pages/templates-page";
import { ToolPanelsPage } from "./pages/tool-panels-page";
import { TouchInputPage } from "./pages/touch-input-page";
import { TouchLayoutPage } from "./pages/touch-layout-page";
import { NativeTouchPage } from "./pages/native-touch-page";
import { WritingFeedbackPage } from "./pages/writing-feedback-page";

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

// These scenarios deliberately fail network-loaded document workers. Disable the
// optional offline capability so its successful cache cannot replace that fault.
// Real SW/cache behavior is covered independently by offline/fixtures.ts.
async function isolateWorkerFailure(page: Page) {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Navigator.prototype, "serviceWorker");
  });
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

async function recoveryFixture(
  page: Page,
  use: (recovery: BoardRecoveryPage) => Promise<void>,
  held: boolean,
) {
  const verify = monitor(page);
  const seed = await page.context().newPage();

  const boards = [
    { id: "main", title: "Damaged" },
    { id: "missing", title: "Unavailable" },
    { id: "geometry", title: "Geometry" },
    { id: "notes", title: "Notebook" },
  ];

  const records = {
    library: {
      format: "penable-library",
      schemaVersion: 1,
      activeId: "main",
      boards,
    },
    main: testBoards.corrupt(),
    "board:geometry": { ...testBoards.legacy(), background: "grid" },
    "board:notes": { ...testBoards.legacy(), background: "dots" },
  };

  try {
    await seedRecords(seed, records);

    await seed.evaluate(
      (locale) => localStorage.setItem("penable:language", locale),
      held ? "en" : "ru",
    );

    if (held) {
      await seed.evaluate(
        () =>
          new Promise<void>((resolve) => {
            void navigator.locks.request("penable:board:main", async () => {
              resolve();
              await new Promise<void>(() => {});
            });
          }),
      );
    }

    await page.goto("/penable/");
    await use(new BoardRecoveryPage(page, records));
  } finally {
    await seed.close();
    verify();
  }
}

async function seedLegacy(page: Page, secondVersion = false) {
  await seedRecords(page, {
    main: secondVersion ? testBoards.previousV2() : testBoards.legacy(),
    "before-import": testBoards.previous(),
    ...(secondVersion ? { "before-schema2": testBoards.legacy() } : {}),
  });
}

async function appearanceWriteFault(page: Page, initial = false) {
  await page.addInitScript((enabled) => {
    let active = enabled,
      hits = 0;

    const original = IDBObjectStore.prototype.put;

    Object.defineProperty(window, "__appearanceWriteFault21", {
      value: (next: boolean) => {
        active = next;
      },
    });

    Object.defineProperty(window, "__appearanceWriteFaultHits21", {
      get: () => hits,
    });

    IDBObjectStore.prototype.put = function (value, key) {
      const request = original.call(this, value, key);

      if (active && this.name === "documents" && key === "library") {
        hits++;
        this.transaction.abort();
      }

      return request;
    };
  }, initial);

  const set = (active: boolean) =>
    page.evaluate((enabled) => {
      const setter = (
        window as unknown as {
          __appearanceWriteFault21: (active: boolean) => void;
        }
      ).__appearanceWriteFault21;

      setter(enabled);
    }, active);

  const hits = () =>
    page.evaluate(
      () =>
        (window as unknown as { __appearanceWriteFaultHits21: number })
          .__appearanceWriteFaultHits21,
    );

  return { set, hits };
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
  writingFeedback: WritingFeedbackPage;
  readOnlyWritingFeedback: WritingFeedbackPage;
  writing: WritingToolsPage;
  templates: TemplatesPage;
  toolPanels: ToolPanelsPage;
  touch: TouchInputPage;
  nativeTouch: NativeTouchPage;
  readOnlyTouch: TouchInputPage;
  touchLayout: TouchLayoutPage;
  keyboardTouchLayout: TouchLayoutPage;
  clipboardAccess: void;
  clipboard: BoardClipboardPage;
  clipboardFailure: BoardClipboardPage;
  transforms: BoardTransformPage;
  images: TestImageTypes.Files;
  imageBoard: BoardImagePage;
  library: BoardLibraryPage;
  appearance: BoardAppearancePage;
  legacyAppearance: BoardAppearancePage;
  appearanceFailure: BoardAppearancePage;
  migrationFailureAppearance: BoardAppearancePage;
  readOnlyAppearance: BoardAppearancePage;
  failedSwitch: { library: BoardLibraryPage; release: () => Promise<void> };
  documents: {
    empty: TestBoardTypes.Document;
    heavy: TestBoardTypes.Document;
    legacy: TestBoardTypes.Document;
    previous: TestBoardTypes.Document;
    v2: TestBoardTypes.Document;
    v3: TestBoardTypes.Document;
    v4: TestBoardTypes.StoredDocument;
    corrupt: unknown;
    missingCatalog: TestBoardTypes.LegacyCatalog;
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
  v4Board: BoardPage;
  pressureHeavyBoard: BoardPage;
  eraserHeavyBoard: BoardPage;
  corruptStorage: StoragePage;
  recoveryBrowser: BoardRecoveryPage;
  recoveryReader: BoardRecoveryPage;
  missingBoardStorage: StoragePage;
  saveFailureBoard: BoardPage;
};

export const test = base.extend<Fixtures>({
  writingFeedback: async ({ page, board }, use) => {
    await use(new WritingFeedbackPage(page, board));
  },

  readOnlyWritingFeedback: async ({ secondBoard }, use) => {
    await use(new WritingFeedbackPage(secondBoard.surface.page(), secondBoard));
  },

  writing: async ({ page, board }, use) => {
    await use(new WritingToolsPage(page, board));
  },

  nativeTouch: async ({ page, context, board }, use) => {
    const session = await context.newCDPSession(page);

    try {
      await use(new NativeTouchPage(page, board, session));
    } finally {
      await session.detach();
    }
  },

  touch: async ({ page, board }, use) => {
    await use(new TouchInputPage(page, board));
  },

  readOnlyTouch: async ({ secondBoard }, use) => {
    await use(new TouchInputPage(secondBoard.surface.page(), secondBoard));
  },

  touchLayout: async ({ page, board }, use) => {
    await use(new TouchLayoutPage(page, board));
  },

  keyboardTouchLayout: async ({ page }, use) => {
    await page.setViewportSize({ width: 390, height: 844 });

    await page.addInitScript(() => {
      const viewport = new EventTarget();
      let height = innerHeight;

      Object.assign(viewport, {
        width: innerWidth,
        scale: 1,
        offsetTop: 0,
        offsetLeft: 0,
      });

      Object.defineProperty(viewport, "height", { get: () => height });

      Object.defineProperty(window, "visualViewport", {
        configurable: true,
        value: viewport,
      });

      Object.defineProperty(window, "__keyboardViewport26", {
        value: (next: number | null) => {
          height = next ?? innerHeight;
          viewport.dispatchEvent(new Event("resize"));
        },
      });
    });

    const verify = monitor(page);
    const board = new BoardPage(page, new StoragePage(page));

    const keyboard = (height: number | null) =>
      page.evaluate((next) => {
        (
          window as unknown as {
            __keyboardViewport26: (value: number | null) => void;
          }
        ).__keyboardViewport26(next);
      }, height);

    try {
      await board.open();
      await use(new TouchLayoutPage(page, board, keyboard));
    } finally {
      verify();
    }
  },

  toolPanels: async ({ page, board }, use) => {
    await use(new ToolPanelsPage(page, board));
  },

  templates: async ({ page, board }, use) => {
    await use(new TemplatesPage(page, board));
  },

  clipboardAccess: [
    async ({ context, browserName }, use) => {
      if (browserName === "chromium")
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

  clipboardFailure: async ({ page, context }, use) => {
    await page.addInitScript(() => {
      const native = navigator.clipboard;

      let mode = "none",
        reads = 0,
        getTypes = 0;

      Object.defineProperty(window, "__clipboardCalls43", {
        get: () => ({ reads, getTypes }),
      });

      Object.defineProperty(window, "__clipboardFault18", {
        get: () => mode,

        set: (next: string) => {
          mode = next;
          reads = 0;
          getTypes = 0;
        },
      });

      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        get: () =>
          mode === "unavailable"
            ? undefined
            : {
                read: async () => {
                  reads++;

                  if (mode === "read-denied")
                    throw new DOMException(
                      "Test read denied",
                      "NotAllowedError",
                    );

                  if (mode === "read-stale-once" && reads === 1)
                    throw new DOMException(
                      "Test clipboard unavailable",
                      "NotReadableError",
                    );

                  const items = await native.read();

                  if (mode === "opaque-read")
                    return items.map(
                      () => ({ types: [] }) as unknown as ClipboardItem,
                    );

                  return items.map(
                    (item) =>
                      ({
                        types: item.types,

                        getType: async (type: string) => {
                          getTypes++;

                          if (mode === "image-stale-once" && getTypes === 1)
                            throw new DOMException(
                              "Test clipboard changed",
                              "InvalidStateError",
                            );

                          return item.getType(type);
                        },
                      }) as ClipboardItem,
                  );
                },

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

      await use(
        new BoardClipboardPage(page, board, async () => {
          const outside = await context.newPage();

          try {
            await outside.goto("about:blank");
            await outside.bringToFront();
          } finally {
            await outside.close();
            await page.bringToFront();
          }
        }),
      );
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

  appearance: async ({ page, board, library }, use) => {
    await use(new BoardAppearancePage(page, board, library));
  },

  legacyAppearance: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, appearanceBoards.records());
      await board.open();

      await use(
        new BoardAppearancePage(page, board, new BoardLibraryPage(page, board)),
      );
    } finally {
      verify();
    }
  },

  appearanceFailure: async ({ page }, use) => {
    const fault = await appearanceWriteFault(page),
      verify = monitor(page);

    const board = new BoardPage(page, new StoragePage(page));

    try {
      await board.open();

      await use(
        new BoardAppearancePage(
          page,
          board,
          new BoardLibraryPage(page, board),
          fault.set,
          fault.hits,
        ),
      );
    } finally {
      verify();
    }
  },

  migrationFailureAppearance: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, appearanceBoards.records());

      const fault = await appearanceWriteFault(page, true);

      await page.goto("/penable/");
      await board.storage.expectSaveError();

      await use(
        new BoardAppearancePage(
          page,
          board,
          new BoardLibraryPage(page, board),
          fault.set,
          fault.hits,
        ),
      );
    } finally {
      verify();
    }
  },

  readOnlyAppearance: async ({ page, context }, use) => {
    const locker = await context.newPage(),
      verify = monitor(page);

    const board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(locker, appearanceBoards.records());

      await locker.evaluate(() => {
        void navigator.locks.request("penable:board:main", async () => {
          (
            window as unknown as { __appearanceLease21: boolean }
          ).__appearanceLease21 = true;

          await new Promise<void>(() => {});
        });
      });

      await locker.waitForFunction(
        () =>
          (window as unknown as { __appearanceLease21: boolean })
            .__appearanceLease21,
      );

      await page.goto("/penable/");
      await board.storage.expectReadOnly();

      await use(
        new BoardAppearancePage(page, board, new BoardLibraryPage(page, board)),
      );
    } finally {
      await locker.close();
      verify();
    }
  },

  failedSwitch: async ({ page }, use) => {
    await isolateWorkerFailure(page);

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
      v4: testBoards.previousV4(),
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

  v4Board: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, {
        main: testBoards.previousV4(),
        "before-import": testBoards.previous(),
        "before-schema2": testBoards.legacy(),
        "before-schema3": testBoards.previousV2(),
        "before-schema4": testBoards.previousV3(),
      });

      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },

  eraserHeavyBoard: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, { main: testBoards.eraserHeavy() });
      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },

  pressureHeavyBoard: async ({ page }, use) => {
    const verify = monitor(page),
      board = new BoardPage(page, new StoragePage(page));

    try {
      await seedRecords(page, { main: testBoards.pressureHeavy() });
      await board.open();
      await use(board);
    } finally {
      verify();
    }
  },

  recoveryBrowser: async ({ page }, use) => {
    await recoveryFixture(page, use, false);
  },

  recoveryReader: async ({ page }, use) => {
    await recoveryFixture(page, use, true);
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
    await isolateWorkerFailure(page);

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
    await isolateWorkerFailure(page);

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
