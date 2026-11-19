import { describe, it, expect, vi } from "vitest";
import { BoardLibrarySession } from "./board-library-session";
import { LibraryCatalog } from "./library-catalog";
import { DocumentSession } from "../session";
import { DocumentCodec, DocumentSnapshots } from "../codec";
import { BoardSnapshots, BoardConstants } from "~/entities/board";
import type { LibraryRepository, BoardCatalog } from "./library.types";
import type {
  DocumentRepository,
  StorageState,
  StoredRecord,
} from "../../board-document.types";
import type { LibraryOptions, LibraryState } from "./library.types";

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

function setup(
  options: {
    writer?: boolean;
    catalog?: unknown;
    legacy?: boolean;
    missingCatalog?: boolean;
    decode?: import("../session").SessionOptions["decode"];
    prepareOwned?: import("./library.types").LibraryOptions["prepareOwned"];
    preflight?: LibraryOptions["preflight"];
  } = {},
) {
  const original = {
    ...DocumentCodec.emptyDocument(),
    schemaVersion: options.legacy ? 2 : 4,
    strokes: [
      {
        id: 1,
        width: 3,
        color: BoardConstants.INK,
        points: [{ x: 40, y: 50, pressure: 0.5, time: 0 }],
      },
    ],
  };

  const records = new Map<string, unknown>([
    [
      "main",
      options.legacy
        ? original
        : DocumentCodec.encodeDocument({ ...original, schemaVersion: 4 }),
    ],
    ["other", DocumentCodec.encodeDocument(DocumentCodec.emptyDocument())],
  ]);

  let catalog: BoardCatalog = {
    ...LibraryCatalog.initial(),
    boards: [
      ...LibraryCatalog.initial().boards,
      {
        id: "other",
        title: "Другая",
        appearance: { color: "blue", icon: "book" },
      },
    ],
  };

  let live = BoardSnapshots.empty(),
    failSave = false,
    gate: Promise<void> | null = null;

  const events: string[] = [],
    borrowed: import("../../board-document.types").WriterLease[] = [];

  const release = vi.fn(async () => {
    events.push("lease-release");
  });

  const read = (id: string): StoredRecord => ({
    exists: records.has(id),
    value: records.get(id),
  });

  const repository: LibraryRepository = {
    read: vi.fn(async () => ({
      catalog: {
        exists: !options.missingCatalog,
        value: options.catalog ?? catalog,
      },
      main: read("main"),
    })),
    board: vi.fn(async (id) => read(id)),
    bootstrap: vi.fn(async (value, document, raw) => {
      catalog = value;
      records.set("main", DocumentCodec.encodeDocument(document));
      records.set("raw", raw.value);
    }),
    migrate: vi.fn(async (value, raw) => {
      catalog = value;
      records.set("before-library-v2", raw.value);
    }),
    update: vi.fn(async (value, change) => {
      events.push("catalog");
      catalog = value;

      if (change?.create)
        records.set(
          change.create.id,
          DocumentCodec.encodeDocument(change.create.document),
        );

      if (change?.remove) records.delete(change.remove);
    }),
    close: vi.fn(async () => {
      events.push("catalog-close");
    }),
  };

  const onLibrary = vi.fn<(state: LibraryState) => void>();
  const onState = vi.fn<(state: StorageState) => void>();

  const onRecoveryPreview =
    vi.fn<NonNullable<LibraryOptions["onRecoveryPreview"]>>();

  let invalidateCatalog: Parameters<LibraryOptions["open"]>[0] = () => {};

  let invalidateDocument: Parameters<
    import("../session").SessionOptions["open"]
  >[0] = () => {};

  const session = new BoardLibrarySession({
    prepareOwned: options.prepareOwned,
    preflight: options.preflight,
    snapshot: () => live,

    onHydrate: (document) => {
      live = BoardSnapshots.clone(document);
      events.push("hydrate");
    },

    onState,
    onLibrary,
    onRecoveryPreview,
    id: () => "created",
    acquire: async () => ({
      acquired: options.writer ?? true,
      message: "readonly",
      release,
    }),

    open: async (invalidated) => {
      invalidateCatalog = invalidated;

      return repository;
    },

    session: (id, lease, callbacks) => {
      borrowed.push(lease);

      const documentRepository: DocumentRepository = {
        read: async () => ({
          main: read(id),
          beforeImport: { exists: false, value: undefined },
        }),

        write: async (document) => {
          events.push(`save:${id}`);
          await gate;

          if (failSave) throw new Error("quota");

          records.set(id, DocumentCodec.encodeDocument(document));
        },

        replace: async (_previous, document) => {
          records.set(id, DocumentCodec.encodeDocument(document));
        },

        close: async () => {
          events.push(`close:${id}`);
        },
      };

      return new DocumentSession({
        ...callbacks,
        decode: options.decode,
        acquire: async () => lease,

        open: async (invalidated) => {
          invalidateDocument = invalidated;

          return documentRepository;
        },
      });
    },
  });

  return {
    session,
    onLibrary,
    onState,
    onRecoveryPreview,
    invalidateCatalog: () => invalidateCatalog("catalog disconnected"),
    invalidateDocument: () => invalidateDocument("document disconnected"),
    repository,
    records,
    release,
    events,
    borrowed,
    get live() {
      return live;
    },
    get catalog() {
      return catalog;
    },

    failSave: () => {
      failSave = true;
    },

    gate: (promise: Promise<void>) => {
      gate = promise;
    },

    original,
  };
}

describe("origin-owned board library", () => {
  it("migrates main and raw recovery atomically before hydrating and borrows the held lease", async () => {
    const h = setup({ legacy: true, missingCatalog: true });

    await h.session.start();
    expect(h.repository.bootstrap).toHaveBeenCalledOnce();
    expect(h.records.get("raw")).toBe(h.original);

    expect(h.records.get("main")).toMatchObject({
      schemaVersion: 5,
      items: [{ kind: "ink", id: 1 }],
    });

    await h.borrowed[0]!.release();
    expect(h.release).not.toHaveBeenCalled();
    await h.session.dispose();
    expect(h.release).toHaveBeenCalledOnce();
  });

  it("opens legacy read-only without bootstrap writes or new catalog", async () => {
    const h = setup({ legacy: true, missingCatalog: true, writer: false });

    await h.session.start();
    expect(h.session.canWrite).toBe(false);
    expect(h.live.strokes).toHaveLength(1);
    expect(h.repository.bootstrap).not.toHaveBeenCalled();
    await expect(h.session.createBoard("Новая")).rejects.toThrow();
    expect(h.repository.update).not.toHaveBeenCalled();
    await h.session.dispose();
  });

  it("refuses corrupt catalogs and exposes the exact raw record for recovery", async () => {
    const corrupt = { format: "penable-library", schemaVersion: 99 };
    const h = setup({ catalog: corrupt });

    await h.session.start();
    expect(h.session.canWrite).toBe(false);
    expect(h.events).not.toContain("hydrate");
    expect(h.session.rawRecord!.value).toBe(corrupt);
    expect(h.repository.update).not.toHaveBeenCalled();
    expect(h.repository.bootstrap).not.toHaveBeenCalled();
    await h.session.dispose();
  });

  it("flushes dirty current notes before switching, then closes old session before target hydration", async () => {
    const h = setup();

    await h.session.start();
    h.live.tools.width = 7;
    h.session.changed(true);
    await h.session.switchBoard("other");
    expect(h.catalog.activeId).toBe("other");

    expect(
      DocumentSnapshots.toSnapshot(
        DocumentCodec.decodeDocument(h.records.get("main")),
      ).tools.width,
    ).toBe(7);

    expect(h.events.indexOf("save:main")).toBeLessThan(
      h.events.indexOf("close:main"),
    );

    expect(h.events.indexOf("close:main")).toBeLessThan(
      h.events.lastIndexOf("hydrate"),
    );

    expect(h.release).not.toHaveBeenCalled();
    await h.session.dispose();
  });

  it("a caught save failure keeps current notes/session/catalog and never switches", async () => {
    const h = setup();

    await h.session.start();
    h.live.tools.width = 9;
    h.session.changed(true);
    h.failSave();
    await expect(h.session.switchBoard("other")).rejects.toThrow("quota");
    expect(h.live.tools.width).toBe(9);
    expect(h.session.hasUnsaved).toBe(true);
    expect(h.catalog.activeId).toBe("main");
    expect(h.events).not.toContain("close:main");
    expect(h.repository.update).not.toHaveBeenCalled();
    await h.session.dispose();
  });

  it("validates a successor before deleting and rejects the last-board deletion", async () => {
    const h = setup();

    await h.session.start();
    h.records.set("other", { invalid: true });
    await expect(h.session.deleteBoard("main")).rejects.toThrow();
    expect(h.records.has("main")).toBe(true);
    expect(h.catalog.activeId).toBe("main");

    h.records.set(
      "other",
      DocumentCodec.encodeDocument(DocumentCodec.emptyDocument()),
    );

    await h.session.deleteBoard("main");
    expect(h.catalog.activeId).toBe("other");
    expect(h.records.has("main")).toBe(false);
    await expect(h.session.deleteBoard("other")).rejects.toThrow("Последнюю");
    await h.session.dispose();
  });

  it("creates independent blank settings and preserves the old board after rename", async () => {
    const h = setup();

    await h.session.start();
    h.live.tools.width = 8;
    h.session.changed(true);
    await h.session.createBoard("  Новая  ");
    expect(h.catalog.activeId).toBe("created");
    expect(h.live.strokes).toHaveLength(0);
    expect(h.live.tools.width).toBe(3);
    await h.session.renameBoard("main", "  Старые записи ");

    expect(h.catalog.boards.find((b) => b.id === "main")!.title).toBe(
      "Старые записи",
    );

    await h.session.switchBoard("main");
    expect(h.live.strokes).toHaveLength(1);
    expect(h.live.tools.width).toBe(8);
    await h.session.dispose();
  });

  it("holds origin authority until a delayed save and child close finish", async () => {
    const h = setup();

    await h.session.start();

    const gate = deferred();

    h.gate(gate.promise);
    h.session.changed(true);

    const saving = h.session.flush();

    await Promise.resolve();

    const disposal = h.session.dispose();

    await Promise.resolve();
    expect(h.release).not.toHaveBeenCalled();
    gate.resolve();
    await saving;
    await disposal;

    expect(h.events.indexOf("close:main")).toBeLessThan(
      h.events.indexOf("lease-release"),
    );
  });
});

it("fails closed when a catalog references a missing active board and preserves catalog recovery", async () => {
  const h = setup();

  h.records.delete("main");
  await h.session.start();
  expect(h.session.canWrite).toBe(false);
  expect(h.events).not.toContain("hydrate");
  expect(h.records.has("main")).toBe(false);
  expect(h.repository.update).not.toHaveBeenCalled();
  expect(h.repository.bootstrap).not.toHaveBeenCalled();

  expect(h.session.rawRecord!.value).toMatchObject({
    format: "penable-library",
    activeId: "main",
  });

  await h.session.dispose();
});

it("exports the selected corrupt document rather than a valid catalog when startup decoding fails", async () => {
  const h = setup(),
    corrupt = { format: "penable-board", schemaVersion: 99, notes: "keep raw" };

  h.records.set("main", corrupt);
  await h.session.start();
  expect(h.events).not.toContain("hydrate");
  expect(h.session.rawRecord!.value).toBe(corrupt);
  expect(h.records.get("main")).toBe(corrupt);
  await h.session.dispose();
});

it.each([true, false])(
  "opens other boards without a writable session or migration when the lease is %s",
  async (writer) => {
    const original = {
      format: "penable-board",
      schemaVersion: 99,
      notes: "raw",
    };

    const h = setup({ writer, catalog: catalog1() });

    h.records.set("main", original);

    const board = DocumentCodec.emptyDocument();

    board.viewport.x = 240;
    h.records.set("other", DocumentCodec.encodeDocument(board));

    await h.session.start();
    expect(h.onState).toHaveBeenLastCalledWith(h.session.state);

    expect(h.session.state).toMatchObject({
      phase: "error",
      loaded: false,
      canImport: false,
      writable: false,
      readOnly: true,
      canReconnect: true,
      hasRawCopy: true,
    });

    await h.session.previewBoard("other");

    expect(h.onRecoveryPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({
        viewport: { x: 240, y: 0, zoom: 1 },
      }),
    );

    expect(h.onLibrary.mock.lastCall?.[0]).toMatchObject({
      activeId: "main",
      recovery: { previewId: "other", pendingId: null },
    });

    expect(h.session.rawRecord?.value).toBe(original);

    expect(h.session.state).toMatchObject({
      writable: false,
      canImport: false,
      hasRawCopy: true,
    });

    h.session.changed(true);
    await h.session.flush();
    h.session.closePreview();
    expect(h.onRecoveryPreview).toHaveBeenLastCalledWith(null);
    expect(h.records.get("main")).toBe(original);
    expect(h.repository.migrate).not.toHaveBeenCalled();
    expect(h.repository.bootstrap).not.toHaveBeenCalled();
    expect(h.repository.update).not.toHaveBeenCalled();
    expect(h.borrowed).toEqual([]);
    await h.session.dispose();
  },
);

it("ignores late previews, keeps a successful preview on failure, and cancels on close", async () => {
  const slow = deferred(),
    reopening = deferred();

  let slowSignal: AbortSignal | undefined;
  let fastSignal: AbortSignal | undefined;

  const catalog = {
    ...catalog1(),
    boards: [...catalog1().boards, { id: "fast", title: "Fast" }],
  };

  const h = setup({
    catalog,

    preflight: async (board, signal) => {
      if (board.viewport.x === 10) {
        slowSignal = signal;
        await slow.promise;
      }

      if (board.viewport.x === 30) {
        fastSignal = signal;
        await reopening.promise;
      }
    },
  });

  const board = (x: number) => {
    const document = DocumentCodec.emptyDocument();

    document.viewport.x = x;

    return DocumentCodec.encodeDocument(document);
  };

  h.records.delete("main");
  h.records.set("other", board(10));
  h.records.set("fast", board(20));
  await h.session.start();

  const pending = h.session.previewBoard("other");

  await vi.waitFor(() => expect(slowSignal).toBeDefined());
  await h.session.previewBoard("fast");
  expect(slowSignal?.aborted).toBe(true);
  slow.resolve();
  await pending;
  expect(h.onRecoveryPreview).toHaveBeenCalledOnce();
  expect(h.onLibrary.mock.lastCall?.[0].recovery?.previewId).toBe("fast");

  h.records.set("other", { corrupt: true });
  await h.session.previewBoard("other");

  expect(h.onLibrary.mock.lastCall?.[0].recovery).toMatchObject({
    previewId: "fast",
    pendingId: null,
    message: { code: "joinedMessage" },
  });

  expect(h.onRecoveryPreview).toHaveBeenCalledOnce();

  h.records.set("other", board(30));

  const closing = h.session.previewBoard("other");

  await vi.waitFor(() => expect(fastSignal).toBeDefined());
  h.session.closePreview();
  expect(fastSignal?.aborted).toBe(true);
  reopening.resolve();
  await closing;
  expect(h.onRecoveryPreview).toHaveBeenCalledTimes(2);
  expect(h.onRecoveryPreview).toHaveBeenLastCalledWith(null);

  expect(h.onLibrary.mock.lastCall?.[0].recovery).toEqual({
    previewId: null,
    pendingId: null,
    message: "",
  });

  await h.session.dispose();
});

it.each(["catalog", "document"] as const)(
  "publishes the same clean reconnect state after %s invalidation",
  async (source) => {
    const h = setup();

    const starting = h.session.start();

    expect(h.onState).toHaveBeenLastCalledWith(h.session.state);

    expect(h.session.state).toMatchObject({
      phase: "loading",
      canReconnect: false,
    });

    await starting;
    (source === "catalog" ? h.invalidateCatalog : h.invalidateDocument)();
    expect(h.onState).toHaveBeenLastCalledWith(h.session.state);

    expect(h.session.state).toMatchObject({
      phase: "error",
      loaded: true,
      writable: false,
      readOnly: true,
      canImport: false,
      canReconnect: true,
    });

    await h.session.dispose();
    expect(h.session.state.canReconnect).toBe(false);
  },
);

it("retains dirty memory and suppresses a late save failure after library invalidation", async () => {
  const h = setup(),
    gate = deferred();

  await h.session.start();
  h.failSave();
  h.gate(gate.promise);
  h.session.changed(true);

  const writing = h.session.flush();

  await vi.waitFor(() => expect(h.events).toContain("save:main"));
  h.invalidateCatalog();

  const status = h.session.state;

  expect(status).toMatchObject({
    phase: "error",
    loaded: true,
    writable: false,
    readOnly: true,
    canImport: false,
    canReconnect: false,
  });

  h.invalidateDocument();
  gate.resolve();
  await writing;
  expect(h.session.state).toEqual(status);
  expect(h.onState).toHaveBeenLastCalledWith(status);
  expect(h.session.hasUnsaved).toBe(true);
  expect(h.events.filter((event) => event === "save:main")).toHaveLength(1);
  await h.session.dispose();
});

it("keeps a healthy board flush available while a library update is busy", async () => {
  const h = setup(),
    gate = deferred();

  await h.session.start();
  h.session.changed(true);
  vi.mocked(h.repository.update).mockReturnValueOnce(gate.promise);

  const renaming = h.session.renameBoard("other", "Renamed");

  expect(h.session.state).toMatchObject({
    writable: false,
    canReconnect: false,
  });

  await h.session.flush();
  expect(h.events).toContain("save:main");
  expect(h.onState).toHaveBeenLastCalledWith(h.session.state);
  gate.resolve();
  await renaming;
  expect(h.session.state).toMatchObject({ writable: true, phase: "saved" });
  await h.session.dispose();
});

it("keeps the captured active record downloadable when preflight is interrupted by invalidation", async () => {
  const gate = deferred();
  const preflight = vi.fn(() => gate.promise);
  const h = setup({ preflight });
  const original = h.records.get("main");
  const starting = h.session.start();

  await vi.waitFor(() => expect(preflight).toHaveBeenCalledOnce());
  h.invalidateCatalog();
  expect(h.onState).toHaveBeenLastCalledWith(h.session.state);

  expect(h.session.state).toMatchObject({
    phase: "error",
    loaded: false,
    hasRawCopy: true,
    canReconnect: false,
  });

  expect(h.session.rawRecord?.value).toBe(original);
  gate.resolve();
  await starting;
  expect(h.onState).toHaveBeenLastCalledWith(h.session.state);

  expect(h.session.state).toMatchObject({
    phase: "error",
    hasRawCopy: true,
    canReconnect: true,
  });

  expect(h.onLibrary.mock.lastCall?.[0].recovery).toBeUndefined();
  expect(h.events).not.toContain("hydrate");
  await h.session.dispose();
});

function catalog1() {
  return {
    format: "penable-library",
    schemaVersion: 1,
    activeId: "main",
    unknown: { preserve: true },
    boards: [
      { id: "main", title: "Старая доска" },
      { id: "other", title: "Другая" },
    ],
  };
}

describe("cover migration and durable appearance changes", () => {
  it("validates the selected document before the writer preserves exact catalog1 and activates", async () => {
    const raw = catalog1(),
      h = setup({ catalog: raw });

    await h.session.start();

    expect(h.repository.migrate).toHaveBeenCalledWith(
      expect.objectContaining({ schemaVersion: 2 }),
      { exists: true, value: raw },
    );

    expect(h.records.get("before-library-v2")).toBe(raw);
    expect(h.session.canWrite).toBe(true);
    await h.session.dispose();
  });

  it("derives identical read-only appearances without migration or any catalog write", async () => {
    const raw = catalog1(),
      writer = setup({ catalog: raw }),
      reader = setup({ catalog: raw, writer: false });

    await writer.session.start();
    await reader.session.start();

    expect(reader.onLibrary.mock.lastCall![0].boards).toEqual(
      writer.onLibrary.mock.lastCall![0].boards,
    );

    expect(reader.repository.migrate).not.toHaveBeenCalled();

    await expect(
      reader.session.setBoardAppearance("main", { color: "pink", icon: "pen" }),
    ).rejects.toThrow();

    expect(reader.repository.update).not.toHaveBeenCalled();
    await writer.session.dispose();
    await reader.session.dispose();
  });

  it("does not attempt migration when the selected document is corrupt", async () => {
    const h = setup({ catalog: catalog1() });

    h.records.set("main", { schemaVersion: 99 });
    await h.session.start();
    expect(h.repository.migrate).not.toHaveBeenCalled();
    expect(h.events).not.toContain("hydrate");
    await h.session.dispose();
  });

  it("does not activate or change documents after migration rejection", async () => {
    const h = setup({ catalog: catalog1() });
    const original = h.records.get("main");

    vi.mocked(h.repository.migrate).mockRejectedValueOnce(
      new Error("migration aborted"),
    );

    await h.session.start();
    expect(h.session.canWrite).toBe(false);
    expect(h.events).not.toContain("hydrate");
    expect(h.records.get("main")).toBe(original);
    expect(h.records.has("before-library-v2")).toBe(false);
    expect(h.repository.update).not.toHaveBeenCalled();
    await h.session.dispose();
  });

  it("publishes appearance only after repository completion and guards concurrent mutation", async () => {
    const h = setup(),
      gate = deferred();

    await h.session.start();

    const before = h.onLibrary.mock.lastCall![0].boards;
    const update = vi.mocked(h.repository.update).getMockImplementation()!;

    vi.mocked(h.repository.update).mockImplementationOnce(async (catalog) => {
      await gate.promise;
      await update(catalog);
    });

    const appearance = { color: "pink" as const, icon: "pen" as const };
    const saving = h.session.setBoardAppearance("other", appearance);

    expect(h.onLibrary.mock.lastCall![0].boards).toEqual(before);
    expect(h.session.canWrite).toBe(false);
    await expect(h.session.renameBoard("main", "Concurrent")).rejects.toThrow();
    gate.resolve();
    await saving;

    expect(h.onLibrary.mock.lastCall![0].boards[1]!.appearance).toEqual(
      appearance,
    );

    expect(h.events.filter((event) => event === "hydrate")).toHaveLength(1);
    expect(h.events).not.toContain("save:main");
    expect(h.live.strokes).toHaveLength(1);
    await h.session.dispose();
  });

  it("keeps failed appearance state unchanged, supports retry/manual duplicates and rename", async () => {
    const h = setup();

    await h.session.start();

    const before = h.onLibrary.mock.lastCall![0].boards;
    const appearance = before[0]!.appearance;

    vi.mocked(h.repository.update).mockRejectedValueOnce(new Error("quota"));

    await expect(
      h.session.setBoardAppearance("other", appearance),
    ).rejects.toThrow("quota");

    expect(h.onLibrary.mock.lastCall![0].boards).toEqual(before);
    expect(h.session.canWrite).toBe(true);
    await h.session.setBoardAppearance("other", appearance);
    await h.session.renameBoard("other", "Renamed");
    expect(h.catalog.boards[1]!.appearance).toEqual(appearance);
    expect(h.catalog.boards[0]!.appearance).toEqual(appearance);

    await expect(
      h.session.setBoardAppearance("missing", appearance),
    ).rejects.toThrow();

    expect(h.catalog.boards).toHaveLength(2);
    await h.session.dispose();
  });
});

it("aborts the active session decode before waiting for library startup and drains before releasing the lease", async () => {
  const decoded = deferred();
  let signal: AbortSignal | undefined;

  const h = setup({
    decode: async (value, current) => {
      signal = current;
      await decoded.promise;

      return DocumentCodec.decodeDocument(value);
    },
  });

  const starting = h.session.start();

  await vi.waitFor(() => expect(signal).toBeDefined());
  expect(h.events).not.toContain("hydrate");

  const disposing = h.session.dispose();

  expect(signal!.aborted).toBe(true);
  expect(h.release).not.toHaveBeenCalled();
  decoded.resolve();
  await starting;
  await disposing;
  expect(h.events).not.toContain("hydrate");

  expect(h.events.indexOf("close:main")).toBeLessThan(
    h.events.indexOf("catalog-close"),
  );

  expect(h.events.indexOf("catalog-close")).toBeLessThan(
    h.events.indexOf("lease-release"),
  );

  expect(h.release).toHaveBeenCalledOnce();
});

it("passes the exact prevalidated owned board to activation without another read or decode", async () => {
  const document = DocumentCodec.emptyDocument();

  document.viewport.x = 543;

  const close = vi.fn(async () => {});

  const prepared: import("../jobs").OwnedPreparedBoard = {
    id: "main",
    records: {
      main: { exists: true, value: Object.freeze({ schemaVersion: 5 }) },
      beforeImport: { exists: false, value: undefined },
    },
    document,
    close,
    bootstrap: vi.fn(),
  };

  const prepareOwned = vi.fn(async () => prepared),
    decode = vi.fn(async () => {
      throw new Error("must not decode again");
    });

  const h = setup({ prepareOwned, decode });

  h.repository.readCatalog = vi.fn(async () => ({
    exists: true,
    value: h.catalog,
  }));

  await h.session.start();
  expect(h.repository.read).not.toHaveBeenCalled();
  expect(h.repository.board).not.toHaveBeenCalled();
  expect(prepareOwned).toHaveBeenCalledOnce();
  expect(decode).not.toHaveBeenCalled();
  expect(h.live.viewport.x).toBe(543);
  expect(close).toHaveBeenCalledOnce();
  await h.session.dispose();
  expect(close).toHaveBeenCalledOnce();
});

it("closes a prepared target after a failed catalog switch while retaining the active board", async () => {
  const close = vi.fn(async () => {});

  const prepareOwned = vi.fn(async (id: string) => ({
    id,
    records: {
      main: { exists: true, value: Object.freeze({ schemaVersion: 5 }) },
      beforeImport: { exists: false, value: undefined },
    },
    document: DocumentCodec.emptyDocument(),
    close,
    bootstrap: vi.fn(),
  }));

  const h = setup({ prepareOwned });

  await h.session.start();
  close.mockClear();

  vi.mocked(h.repository.update).mockRejectedValueOnce(
    new Error("catalog transaction failed"),
  );

  await expect(h.session.switchBoard("other")).rejects.toThrow(
    "catalog transaction failed",
  );

  expect(close).toHaveBeenCalledOnce();
  expect(h.session.canWrite).toBe(true);
  expect(h.catalog.activeId).toBe("main");
  await h.session.dispose();
});
