import { DocumentCodec } from "../modules/codec";
import type { LibraryRepository } from "../board-document.types";
import type { StoredRecord } from "../board-document.types";

function open(
  invalidated: (message: string) => void,
  factory: IDBFactory | undefined = globalThis.indexedDB,
): Promise<LibraryRepository> {
  if (!factory)
    return Promise.reject(new Error("IndexedDB недоступен в этом браузере."));

  return new Promise((resolve, reject) => {
    const request = factory.open("penable", 1);
    let failed = false;

    request.onblocked = () => {
      failed = true;
      reject(new Error("Открытие хранилища заблокировано другой страницей."));
    };

    request.onerror = () =>
      reject(request.error ?? new Error("Не удалось открыть каталог досок."));

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
        reject(new Error("Неподдерживаемое хранилище досок."));

        return;
      }

      const definition = db
        .transaction("documents", "readonly")
        .objectStore("documents");

      if (definition.keyPath !== null || definition.autoIncrement) {
        db.close();
        reject(new Error("Неподдерживаемая структура documents."));

        return;
      }

      let closed = false;
      const pending = new Set<Promise<unknown>>();

      db.onversionchange = () => {
        if (!closed) {
          closed = true;
          db.close();
          invalidated("Версия хранилища изменилась. Повторите подключение.");
        }
      };

      db.onclose = () => {
        if (!closed) {
          closed = true;

          invalidated(
            "Хранилище досок закрыто. Изменения в памяти доступны для экспорта.",
          );
        }
      };

      function transaction<T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore, result: (value: T) => void) => void,
      ): Promise<T> {
        if (closed) return Promise.reject(new Error("Каталог досок закрыт."));

        const tx = db.transaction("documents", mode);

        const task = new Promise<T>((done, fail) => {
          let result: T;
          let error: unknown;

          tx.oncomplete = () => done(result);

          tx.onabort = () =>
            fail(
              error ?? tx.error ?? new Error("Изменение каталога отменено."),
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
              for (const name of [
                "before-library",
                ...(document.schemaVersion === 4 &&
                raw.value &&
                typeof raw.value === "object" &&
                "schemaVersion" in raw.value &&
                raw.value.schemaVersion !== 4
                  ? ["before-schema4"]
                  : []),
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
