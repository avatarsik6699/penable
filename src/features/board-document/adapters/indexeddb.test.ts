import { describe, expect, it, vi } from "vitest";
import { DocumentRepositoryAdapter } from "./indexeddb";
import { DocumentCodec } from "../model/codec";

function request() {
  return {
    result: undefined as unknown,
    error: null as DOMException | null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
}

function fakeDatabase(keyPath: string | null = null, autoIncrement = false) {
  const transactions: ReturnType<typeof transaction>[] = [];

  function transaction() {
    const reads = new Map<string, ReturnType<typeof request>>();
    const puts: Array<[unknown, IDBValidKey | undefined]> = [];

    const store = {
      keyPath,
      autoIncrement,

      get: (key: string) => {
        const req = request();

        reads.set(`value:${key}`, req);

        return req;
      },

      getKey: (key: string) => {
        const req = request();

        reads.set(`key:${key}`, req);

        return req;
      },

      put: (value: unknown, key?: IDBValidKey) => {
        puts.push([value, key]);

        return request();
      },
    };

    return {
      objectStore: () => store,
      reads,
      puts,
      oncomplete: null as (() => void) | null,
      onabort: null as (() => void) | null,
      onerror: null as (() => void) | null,
      error: null as DOMException | null,

      abort() {
        this.onabort?.();
      },
    };
  }

  const db = {
    objectStoreNames: { contains: () => true },
    transaction: vi.fn(() => {
      const tx = transaction();

      transactions.push(tx);

      return tx;
    }),
    close: vi.fn(),
    onversionchange: null as (() => void) | null,
    onclose: null as (() => void) | null,
  };

  const opening = {
    result: db,
    error: null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
    onblocked: null as (() => void) | null,
    onupgradeneeded: null as (() => void) | null,
  };

  const factory = { open: vi.fn(() => opening) } as unknown as IDBFactory;
  const onInvalidated = vi.fn();

  const opened = DocumentRepositoryAdapter.openRepository(
    onInvalidated,
    factory,
  );

  return { db, opening, transactions, opened, onInvalidated };
}

describe("native IndexedDB adapter transaction boundary", () => {
  it("resolves a write on transaction.complete, not request success, and rejects abort", async () => {
    const h = fakeDatabase();

    h.opening.onsuccess?.();

    const repository = await h.opened;
    let settled = false;

    const writing = repository.write(DocumentCodec.emptyDocument()).then(() => {
      settled = true;
    });

    const tx = h.transactions.at(-1)!;

    expect(tx.puts[0]?.[1]).toBe("main");
    await Promise.resolve();
    expect(settled).toBe(false);
    tx.oncomplete?.();
    await writing;
    expect(settled).toBe(true);

    const aborted = repository.write(DocumentCodec.emptyDocument());
    const assertion = expect(aborted).rejects.toThrow();

    h.transactions.at(-1)!.onabort?.();
    await assertion;
    await repository.close();
  });

  it("distinguishes missing main from stored null/undefined using key requests in the same transaction", async () => {
    const h = fakeDatabase();

    h.opening.onsuccess?.();

    const repository = await h.opened;
    const reading = repository.read();
    const tx = h.transactions.at(-1)!;

    const respond = (key: string, value: unknown) => {
      const req = tx.reads.get(key)!;

      req.result = value;
      req.onsuccess?.();
    };

    respond("key:main", "main");
    respond("value:main", undefined);
    respond("key:before-import", undefined);
    respond("value:before-import", undefined);
    tx.oncomplete?.();

    expect(await reading).toEqual({
      main: { exists: true, value: undefined },
      beforeImport: { exists: false, value: undefined },
      beforeSchema2: { exists: false, value: undefined },
    });

    await repository.close();
  });

  it("enqueues backup and candidate puts in one transaction and closes on versionchange", async () => {
    const h = fakeDatabase();

    h.opening.onsuccess?.();

    const repository = await h.opened;
    const candidate = DocumentCodec.emptyDocument();
    const replacing = repository.replace(null, candidate);
    const tx = h.transactions.at(-1)!;

    expect(tx.puts).toEqual([
      [null, "before-import"],
      [candidate, "main"],
    ]);

    tx.oncomplete?.();
    await replacing;
    h.db.onversionchange?.();
    expect(h.db.close).toHaveBeenCalledOnce();
    expect(h.onInvalidated).toHaveBeenCalledOnce();
    await expect(repository.write(candidate)).rejects.toThrow("закрыто");
    await repository.close();
  });

  it.each([
    ["id", false],
    [null, true],
  ] as const)(
    "rejects unknown keyPath/autoIncrement schema %s/%s",
    async (keyPath, autoIncrement) => {
      const h = fakeDatabase(keyPath, autoIncrement);
      const assertion = expect(h.opened).rejects.toThrow("структура");

      h.opening.onsuccess?.();
      await assertion;
      expect(h.db.close).toHaveBeenCalledOnce();
    },
  );

  it("rejects blocked opening and closes a late successful connection instead of exposing it", async () => {
    const h = fakeDatabase();
    const assertion = expect(h.opened).rejects.toThrow("заблокировано");

    h.opening.onblocked?.();
    await assertion;
    h.opening.onsuccess?.();
    expect(h.db.close).toHaveBeenCalledOnce();
  });
});

describe("atomic schema2 upgrade copy", () => {
  it.each(["write", "replace"] as const)(
    "preserves exact schema1 main in the %s transaction separately from import backup",
    async (mode) => {
      const h = fakeDatabase();

      h.opening.onsuccess?.();

      const repository = await h.opened;

      const raw = {
          ...DocumentCodec.emptyDocument(),
          schemaVersion: 1,
          originalUnknownField: { keep: true },
        },
        candidate = DocumentCodec.emptyDocument();

      const writing =
        mode === "write"
          ? repository.write(candidate)
          : repository.replace({ current: "memory" }, candidate);

      const tx = h.transactions.at(-1)!;

      const main = tx.reads.get("value:main")!,
        key = tx.reads.get("key:before-schema2")!;

      main.result = raw;
      main.onsuccess?.();
      expect(tx.puts.some(([, key]) => key === "before-schema2")).toBe(false);
      key.result = undefined;
      key.onsuccess?.();

      const backup = tx.puts.find(([, key]) => key === "before-schema2")!;

      expect(backup[0]).toBe(raw);
      expect(tx.puts.find(([, key]) => key === "main")![0]).toBe(candidate);

      expect(tx.puts.some(([, key]) => key === "before-import")).toBe(
        mode === "replace",
      );

      tx.oncomplete?.();
      await writing;
      await repository.close();
    },
  );

  it("keeps an existing upgrade copy and rejects aborted upgrade writes", async () => {
    const h = fakeDatabase();

    h.opening.onsuccess?.();

    const repository = await h.opened;

    const writing = repository.write(DocumentCodec.emptyDocument()),
      tx = h.transactions.at(-1)!;

    const main = tx.reads.get("value:main")!,
      key = tx.reads.get("key:before-schema2")!;

    main.result = { ...DocumentCodec.emptyDocument(), schemaVersion: 1 };
    main.onsuccess?.();
    key.result = "before-schema2";
    key.onsuccess?.();
    expect(tx.puts.some(([, key]) => key === "before-schema2")).toBe(false);

    const failure = expect(writing).rejects.toThrow();

    tx.onabort?.();
    await failure;
    await repository.close();
  });
});

describe("schema2 preservation read budget", () => {
  it("skips deserializing old main only after successful schema2 completion, never after abort", async () => {
    const h = fakeDatabase();

    h.opening.onsuccess?.();

    const repository = await h.opened;

    const first = repository.write(DocumentCodec.emptyDocument()),
      aborted = h.transactions.at(-1)!;

    const failed = expect(first).rejects.toThrow();

    aborted.onabort?.();
    await failed;

    const retry = repository.write(DocumentCodec.emptyDocument()),
      retried = h.transactions.at(-1)!;

    expect(retried.reads.has("value:main")).toBe(true);
    retried.oncomplete?.();
    await retry;

    const second = repository.write(DocumentCodec.emptyDocument()),
      saved = h.transactions.at(-1)!;

    expect(saved.reads.size).toBe(0);
    saved.oncomplete?.();
    await second;

    const replacement = repository.replace(
        { before: "memory" },
        DocumentCodec.emptyDocument(),
      ),
      replaced = h.transactions.at(-1)!;

    expect(replaced.reads.size).toBe(0);
    expect(replaced.puts).toHaveLength(2);
    replaced.oncomplete?.();
    await replacement;
    await repository.close();
  });
});
