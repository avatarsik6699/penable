import { describe, expect, it, vi } from "vitest";
import { LibraryRepositoryAdapter } from "./library-indexeddb";
import { LibraryCatalog } from "../modules/library";

function database() {
  const transactions: ReturnType<typeof transaction>[] = [];

  function transaction() {
    const puts: Array<[unknown, string]> = [];

    const reads = new Map<
      string,
      { result: unknown; onsuccess: null | (() => void) }
    >();

    const store = {
      keyPath: null,
      autoIncrement: false,

      getKey: (key: string) => {
        const request = {
          result: undefined as unknown,
          onsuccess: null as null | (() => void),
        };

        reads.set(key, request);

        return request;
      },

      put: (value: unknown, key: string) => {
        puts.push([value, key]);
      },
    };

    return {
      objectStore: () => store,
      puts,
      reads,
      oncomplete: null as null | (() => void),
      onabort: null as null | (() => void),
      onerror: null as null | (() => void),
      error: null,

      abort() {
        this.onabort?.();
      },
    };
  }

  const db = {
    objectStoreNames: { contains: () => true },
    close: vi.fn(),
    transaction: vi.fn(() => {
      const tx = transaction();

      transactions.push(tx);

      return tx;
    }),
    onversionchange: null,
    onclose: null,
  };

  const request = { result: db, onsuccess: null as null | (() => void) };
  const factory = { open: vi.fn(() => request) } as unknown as IDBFactory;
  const opened = LibraryRepositoryAdapter.open(() => {}, factory);

  request.onsuccess?.();

  return { transactions, opened, factory };
}

describe("atomic native library-v2 migration", () => {
  it("backs up the exact original catalog and writes catalog2 within one transaction, resolving only on complete", async () => {
    const h = database(),
      repository = await h.opened;

    const raw = {
      format: "penable-library",
      schemaVersion: 1,
      activeId: "main",
      boards: [{ id: "main", title: "Original" }],
      unknown: { retain: true },
    };

    const catalog = LibraryCatalog.decode(raw);
    let settled = false;

    const migrating = repository
      .migrate(catalog, { exists: true, value: raw })
      .then(() => {
        settled = true;
      });

    const tx = h.transactions.at(-1)!;

    expect(tx.puts).toEqual([[catalog, "library"]]);

    const backup = tx.reads.get("before-library-v2")!;

    backup.result = undefined;
    backup.onsuccess?.();

    expect(tx.puts.find(([, key]) => key === "before-library-v2")![0]).toBe(
      raw,
    );

    expect(tx.puts).toHaveLength(2);
    await Promise.resolve();
    expect(settled).toBe(false);
    tx.oncomplete?.();
    await migrating;
    expect(settled).toBe(true);
    expect(h.factory.open).toHaveBeenCalledWith("penable", 1);
    await repository.close();
  });

  it("never overwrites an existing backup, and exposes abort so callers cannot publish candidate state", async () => {
    const h = database(),
      repository = await h.opened;

    const migrating = repository.migrate(LibraryCatalog.initial(), {
      exists: true,
      value: { schemaVersion: 1 },
    });

    const tx = h.transactions.at(-1)!;
    const backup = tx.reads.get("before-library-v2")!;

    backup.result = "before-library-v2";
    backup.onsuccess?.();
    expect(tx.puts.map(([, key]) => key)).toEqual(["library"]);

    const rejected = expect(migrating).rejects.toThrow("отменено");

    tx.onabort?.();
    await rejected;
    await repository.close();
  });
});
