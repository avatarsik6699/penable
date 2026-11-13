import { describe, it, expect, vi } from "vitest";
import { BoardLibrarySession } from "./board-library-session";
import { LibraryCatalog } from "./library-catalog";
import { DocumentSession } from "../session";
import { DocumentCodec, DocumentSnapshots } from "../codec";
import { BoardSnapshots, BoardConstants } from "~/entities/board";
import type { LibraryRepository, BoardCatalog } from "./library.types";
import type {
  DocumentRepository,
  StoredRecord,
} from "../../board-document.types";

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
      { id: "other", title: "Другая" },
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

  const session = new BoardLibrarySession({
    snapshot: () => live,

    onHydrate: (document) => {
      live = BoardSnapshots.clone(document);
      events.push("hydrate");
    },

    onState: vi.fn(),
    onLibrary: vi.fn(),
    id: () => "created",
    acquire: async () => ({
      acquired: options.writer ?? true,
      message: "readonly",
      release,
    }),
    open: async () => repository,

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
        acquire: async () => lease,
        open: async () => documentRepository,
      });
    },
  });

  return {
    session,
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
      schemaVersion: 4,
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
