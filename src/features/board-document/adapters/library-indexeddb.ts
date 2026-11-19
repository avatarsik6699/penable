import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { DocumentCodec, DocumentSchema } from "../modules/codec";
import type { LibraryRepository } from "../board-document.types";
import type { StoredRecord } from "../board-document.types";

function open(
  invalidated: (message: MessageTypes.Value) => void,
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<LibraryRepository> {
  if (!factory)
    return Promise.reject(
      Messages.error(Messages.create("indexeddbIsUnavailableInThisBrowser")),
    );

  return new Promise((resolve, reject) => {
    const request = factory.open("penable", 1);
    let failed = false;

    request.onblocked = () => {
      failed = true;

      reject(
        Messages.error(Messages.create("anotherPageIsBlockingStorageAccess")),
      );
    };

    request.onerror = () =>
      reject(
        request.error ??
          Messages.error(Messages.create("couldNotOpenTheBoardCatalog")),
      );

    request.onupgradeneeded = () => {
      if (failed) {
        request.transaction?.abort();

        return;
      }

      if (!request.result.objectStoreNames.contains("documents"))
        request.result.createObjectStore("documents");
    };

    request.onsuccess = () => {
      const db = request.result;

      if (failed) {
        db.close();

        return;
      }

      if (!db.objectStoreNames.contains("documents")) {
        db.close();
        reject(Messages.error(Messages.create("unsupportedBoardStorage")));

        return;
      }

      const definition = db
        .transaction("documents", "readonly")
        .objectStore("documents");

      if (definition.keyPath !== null || definition.autoIncrement) {
        db.close();

        reject(
          Messages.error(Messages.create("unsupportedDocumentsStructure")),
        );

        return;
      }

      let closed = false;
      const pending = new Set<Promise<unknown>>();

      db.onversionchange = () => {
        if (!closed) {
          closed = true;
          db.close();

          invalidated(
            Messages.create("storageVersionChangedReconnectToContinue"),
          );
        }
      };

      db.onclose = () => {
        if (!closed) {
          closed = true;
          invalidated(Messages.create("boardStorageClosedChangesInMemoryCan"));
        }
      };

      function transaction<T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore, result: (value: T) => void) => void,
      ): Promise<T> {
        if (closed)
          return Promise.reject(
            Messages.error(Messages.create("boardCatalogClosed")),
          );

        const tx = db.transaction("documents", mode);

        const task = new Promise<T>((done, fail) => {
          let result: T;
          let error: unknown;

          tx.oncomplete = () => done(result);

          tx.onabort = () =>
            fail(
              error ??
                tx.error ??
                Messages.error(Messages.create("catalogUpdateCancelled")),
            );

          tx.onerror = () => {
            error = tx.error;
          };

          try {
            run(tx.objectStore("documents"), (value) => {
              result = value;
            });
          } catch (failure) {
            error = failure;
            tx.abort();
          }
        });

        pending.add(task);

        void task.then(
          () => pending.delete(task),
          () => pending.delete(task),
        );

        return task;
      }

      function readRecord(store: IDBObjectStore, key: string): StoredRecord {
        const record: StoredRecord = { exists: false, value: undefined },
          value = store.get(key),
          exists = store.getKey(key);

        value.onsuccess = () => {
          record.value = value.result as unknown;
        };

        exists.onsuccess = () => {
          record.exists = exists.result !== undefined;
        };

        return record;
      }

      const key = (id: string) => (id === "main" ? "main" : `board:${id}`);

      resolve({
        readCatalog: () =>
          transaction("readonly", (store, result) =>
            result(readRecord(store, "library")),
          ),
        read: () =>
          transaction("readonly", (store, result) =>
            result({
              catalog: readRecord(store, "library"),
              main: readRecord(store, "main"),
            }),
          ),
        board: (id) =>
          transaction("readonly", (store, result) =>
            result(readRecord(store, key(id))),
          ),
        bootstrap: (catalog, document, raw) =>
          transaction<void>("readwrite", (store, result) => {
            if (raw.exists) {
              const backups = DocumentSchema.upgradeBackups(
                DocumentSchema.current(document.strokes),
                raw,
              );

              for (const name of [
                "before-library",
                ...(backups.beforeSchema4 ? ["before-schema4"] : []),
                ...(backups.beforeSchema5 ? ["before-schema5"] : []),
                ...(backups.beforeSchema6 ? ["before-schema6"] : []),
              ]) {
                const existing = store.getKey(name);

                existing.onsuccess = () => {
                  if (existing.result === undefined) store.put(raw.value, name);
                };
              }
            }

            store.put(DocumentCodec.encodeDocument(document), "main");
            store.put(catalog, "library");
            result(undefined);
          }),
        migrate: (catalog, raw) =>
          transaction<void>("readwrite", (store, result) => {
            const existing = store.getKey("before-library-v2");

            existing.onsuccess = () => {
              if (existing.result === undefined)
                store.put(raw.value, "before-library-v2");
            };

            store.put(catalog, "library");
            result(undefined);
          }),
        update: (catalog, change) =>
          transaction<void>("readwrite", (store, result) => {
            if (change?.create)
              store.add(
                DocumentCodec.encodeDocument(change.create.document),
                key(change.create.id),
              );

            if (change?.remove) {
              const scope = key(change.remove);

              store.delete(scope);

              for (const name of [
                "before-import",
                "before-schema2",
                "before-schema3",
                "before-schema4",
                "before-schema5",
                "before-schema6",
                "before-library",
              ])
                store.delete(
                  change.remove === "main" ? name : `${scope}:${name}`,
                );
            }

            store.put(catalog, "library");
            result(undefined);
          }),

        close: async () => {
          closed = true;
          await Promise.allSettled([...pending]);
          db.close();
        },
      });
    };
  });
}

export const LibraryRepositoryAdapter = { open };
