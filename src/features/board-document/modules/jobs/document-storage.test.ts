import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentCodec } from "../codec";
import { RecordCopies } from "../record-copies";
import { DocumentStorage } from "./document-storage";
import { LibraryCatalog } from "../library";
import type {
  DocumentRecords,
  StorageReadRequest,
  StorageReadResponse,
} from "./document-storage.types";
import type { JobWorker } from "./document-jobs.types";
import type { BoardDocument } from "../../board-document.types";

function records(
  main: unknown,
  extra: Partial<DocumentRecords> = {},
): DocumentRecords {
  return {
    main: { exists: true, value: main },
    beforeImport: { exists: false, value: undefined },
    beforeSchema2: { exists: false, value: undefined },
    beforeSchema3: { exists: false, value: undefined },
    beforeSchema4: { exists: false, value: undefined },
    beforeSchema5: { exists: false, value: undefined },
    beforeSchema6: { exists: false, value: undefined },
    beforeLibrary: { exists: false, value: undefined },
    ...extra,
  };
}

async function setup(initial: DocumentRecords) {
  vi.resetModules();

  const stored = structuredClone(initial),
    requests: StorageReadRequest[] = [];

  const repository = {
    read: vi.fn(async () => structuredClone(stored)),
    close: vi.fn(async () => {}),
    write: vi.fn(),
    replace: vi.fn(),
  };

  const library = {
    bootstrap: vi.fn(async (_catalog: unknown, candidate: BoardDocument) => {
      stored.main = {
        exists: true,
        value: DocumentCodec.encodeDocument(candidate),
      };
    }),
    close: vi.fn(async () => {}),
  };

  const adapter = await import("../../adapters/indexeddb"),
    libraryAdapter = await import("../../adapters/library-indexeddb");

  vi.spyOn(
    adapter.DocumentRepositoryAdapter,
    "openRepository",
  ).mockResolvedValue(repository);

  vi.spyOn(libraryAdapter.LibraryRepositoryAdapter, "open").mockResolvedValue(
    library as unknown as import("../../board-document.types").LibraryRepository,
  );

  let terminated = false;

  const host = {
    onmessage: null as
      ((event: MessageEvent<StorageReadRequest>) => void) | null,

    postMessage(message: StorageReadResponse, transfer?: Transferable[]) {
      const data = structuredClone(message, { transfer: transfer ?? [] });

      queueMicrotask(() => {
        if (!terminated)
          worker.onmessage?.call(
            worker as Worker,
            { data } as MessageEvent<StorageReadResponse>,
          );
      });
    },
  };

  const worker: JobWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: vi.fn(() => {
      terminated = true;
    }),
    postMessage: ((message: StorageReadRequest) => {
      requests.push(message);

      const data = structuredClone(message);

      queueMicrotask(() => {
        if (!terminated)
          host.onmessage?.({ data } as MessageEvent<StorageReadRequest>);
      });
    }) as JobWorker["postMessage"],
  };

  vi.stubGlobal("self", host);
  await import("./document-storage-worker");

  const codec = (await import("../codec")).DocumentCodec;

  return {
    codec,
    host,
    worker,
    requests,
    stored,
    repository,
    library,
    load: () =>
      DocumentStorage.load("main", new AbortController().signal, () => worker),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Worker-owned storage snapshot", () => {
  it("loads schema6 text and keeps the exact version5 recovery copy detached after worker termination", async () => {
    const document = DocumentCodec.emptyDocument();

    document.strokes.push({
      kind: "text",
      id: 1,
      text: "Перо\n💡",
      width: 180,
      lines: [0, 5],
      matrix: [1, 0, 0, 1, 20, 30],
    });

    const raw = DocumentCodec.encodeDocument(document);

    const previous = {
      ...DocumentCodec.encodeDocument(DocumentCodec.emptyDocument()),
      preserve: "previous raw field",
    };

    const h = await setup(
      records(raw, { beforeSchema6: { exists: true, value: previous } }),
    );

    const loaded = await h.load();
    const copy = loaded.records.beforeSchema6!.value;

    expect(loaded.document).toEqual({ ...document, schemaVersion: 6 });
    expect(h.repository.write).not.toHaveBeenCalled();
    h.stored.beforeSchema6!.value = { changed: true };
    await loaded.close();
    expect(JSON.parse(await RecordCopies.read(copy)!.text())).toEqual(previous);
  });

  it("reads all raw records once, returns only packed validated data and immutable recovery Blobs", async () => {
    const source = DocumentCodec.emptyDocument();

    source.strokes.push({
      id: 1,
      width: 3,
      color: "#182230",
      points: [{ x: 1, y: 2, pressure: 0.5, time: 0 }],
    });

    const raw = DocumentCodec.encodeDocument(source),
      previous = { exact: [1, 2, 3] };

    const h = await setup(
      records(raw, { beforeImport: { exists: true, value: previous } }),
    );

    const loaded = await h.load();

    expect(loaded.document).toEqual(DocumentCodec.decodeDocument(raw));
    expect(Object.isFrozen(loaded.records.main.value)).toBe(true);
    expect(loaded.records.main.value).toEqual({ schemaVersion: 5 });
    h.stored.beforeImport.value = { changed: true };

    const blob = RecordCopies.read(loaded.records.beforeImport.value)!;

    expect(await blob.text()).toBe(DocumentCodec.serializeRawBackup(previous));
    await loaded.close();
    expect(h.repository.read).toHaveBeenCalledOnce();
    expect(h.repository.close).toHaveBeenCalledOnce();
    expect(h.worker.terminate).toHaveBeenCalledOnce();
    expect(await blob.text()).toBe(DocumentCodec.serializeRawBackup(previous));
  });

  it("retains exact recovery copies after a loader crash and rejects non-JSON raw recovery honestly", async () => {
    const raw = DocumentCodec.encodeDocument(DocumentCodec.emptyDocument());

    const h = await setup(
      records(raw, {
        beforeImport: { exists: true, value: new Uint8Array([1, 2]) },
      }),
    );

    const loaded = await h.load(),
      blob = RecordCopies.read(loaded.records.main.value)!;

    h.worker.onerror?.call(
      h.worker as Worker,
      { preventDefault() {} } as ErrorEvent,
    );

    expect(await blob.text()).toBe(DocumentCodec.serializeRawBackup(raw));

    expect(() =>
      RecordCopies.read(loaded.records.beforeImport.value),
    ).toThrow();

    await loaded.close();
    expect(h.worker.terminate).toHaveBeenCalledOnce();
  });

  it("returns raw recovery with a strict validation error without publishing a partial document", async () => {
    const h = await setup(records({ malformed: true })),
      loaded = await h.load();

    expect(loaded.document).toBeUndefined();
    expect(loaded.error).toBeTruthy();

    expect(await RecordCopies.read(loaded.records.main.value)!.text()).toBe(
      '{"malformed":true}',
    );

    await loaded.close();
  });

  it("bootstraps legacy data in the same Worker and publishes post-bootstrap schema/recovery records", async () => {
    const legacy = {
      ...DocumentCodec.emptyDocument(),
      schemaVersion: 1 as const,
    };

    const beforeLibrary = { older: "exact existing backup" };

    const h = await setup(
      records(legacy, {
        beforeLibrary: { exists: true, value: beforeLibrary },
      }),
    );

    const loaded = await h.load();

    await loaded.bootstrap(LibraryCatalog.initial());
    expect(h.repository.read).toHaveBeenCalledOnce();
    expect(h.library.bootstrap).toHaveBeenCalledOnce();
    expect(loaded.records.main.value).toEqual({ schemaVersion: 5 });

    expect(
      await RecordCopies.read(loaded.records.beforeLibrary!.value)!.text(),
    ).toBe(DocumentCodec.serializeRawBackup(beforeLibrary));

    expect(
      await RecordCopies.read(loaded.records.beforeSchema5!.value)!.text(),
    ).toBe(DocumentCodec.serializeRawBackup(legacy));

    const persisted = JSON.parse(
      await RecordCopies.read(loaded.records.main.value)!.text(),
    ) as unknown;

    expect(DocumentCodec.decodeDocument(persisted).schemaVersion).toBe(5);

    expect(
      h.requests.filter((request) => request.type === "bootstrap"),
    ).toHaveLength(1);

    expect(
      h.requests.every((request) => !Object.hasOwn(request, "document")),
    ).toBe(true);

    await loaded.close();
  });

  it("drains bootstrap before close and never cancels an already-started durable transaction", async () => {
    const h = await setup(
      records(DocumentCodec.encodeDocument(DocumentCodec.emptyDocument())),
    );

    let complete!: () => void, started!: () => void;

    const gate = new Promise<void>((yes) => {
      complete = yes;
    });

    const began = new Promise<void>((yes) => {
      started = yes;
    });

    h.library.bootstrap.mockImplementationOnce(async () => {
      started();
      await gate;
    });

    const loaded = await h.load(),
      bootstrap = loaded.bootstrap(LibraryCatalog.initial());

    await began;

    const closing = loaded.close();

    expect(h.worker.terminate).not.toHaveBeenCalled();
    expect(h.repository.close).not.toHaveBeenCalled();
    complete();
    await Promise.all([bootstrap, closing]);
    expect(h.repository.close).toHaveBeenCalledOnce();
  });
});

it("drains a live invalidated bootstrap before closing and ignores its stale completion", async () => {
  const h = await setup(
    records(DocumentCodec.encodeDocument(DocumentCodec.emptyDocument())),
  );

  let complete!: () => void, started!: () => void;

  const gate = new Promise<void>((yes) => {
    complete = yes;
  });

  const began = new Promise<void>((yes) => {
    started = yes;
  });

  h.library.bootstrap.mockImplementationOnce(async () => {
    started();
    await gate;
  });

  h.library.close.mockImplementationOnce(async () => {
    await gate;
  });

  const loaded = await h.load(),
    bootstrap = loaded.bootstrap(LibraryCatalog.initial());

  const rejected = expect(bootstrap).rejects.toThrow("invalidated");

  await began;
  h.host.postMessage({ type: "storage-error", error: "invalidated" });
  await rejected;

  let closed = false;

  const closing = loaded.close().then(() => {
    closed = true;
  });

  await Promise.resolve();
  await Promise.resolve();
  expect(h.worker.terminate).not.toHaveBeenCalled();
  expect(closed).toBe(false);
  complete();
  await closing;
  expect(h.library.close).toHaveBeenCalledOnce();
  expect(h.worker.terminate).toHaveBeenCalledOnce();
});

it("reuses recovery serialization for the same immutable raw identity across records and bootstrap publication", async () => {
  const raw = { ...DocumentCodec.emptyDocument(), schemaVersion: 1 as const };

  const h = await setup(
    records(raw, { beforeImport: { exists: true, value: raw } }),
  );

  const serialize = vi.spyOn(h.codec, "serializeRawBackup");
  const loaded = await h.load();

  expect(serialize).toHaveBeenCalledOnce();
  await loaded.bootstrap(LibraryCatalog.initial());
  expect(serialize).toHaveBeenCalledTimes(2);

  expect(
    await RecordCopies.read(loaded.records.beforeLibrary!.value)!.text(),
  ).toBe(DocumentCodec.serializeRawBackup(raw));

  await loaded.close();
});
