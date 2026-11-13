import { DocumentCodec } from "../modules/codec";
import type {
  BoardDocument,
  DocumentRepository,
} from "../board-document.types";

const DATABASE_NAME = "penable";
const STORE_NAME = "documents";

function openRepository(
  onInvalidated: (message: string) => void,
  factory: IDBFactory | undefined = globalThis.indexedDB,
  boardId = "main",
): Promise<DocumentRepository> {
  const boardKey = boardId === "main" ? "main" : `board:${boardId}`;

  const backupKeyFor = (name: string) =>
    boardId === "main" ? name : `${boardKey}:${name}`;

  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(boardId))
    return Promise.reject(new Error("Недопустимый идентификатор доски."));

  if (!factory)
    return Promise.reject(new Error("IndexedDB недоступен в этом браузере."));

  return new Promise((resolve, reject) => {
    let settled = false;
    const opening = factory.open(DATABASE_NAME, 1);

    opening.onblocked = () => {
      settled = true;

      reject(
        new Error(
          "Открытие хранилища заблокировано другой страницей. Закройте её и повторите.",
        ),
      );
    };

    opening.onerror = () => {
      settled = true;
      reject(opening.error ?? new Error("Не удалось открыть IndexedDB."));
    };

    opening.onupgradeneeded = () => {
      if (settled) {
        opening.transaction?.abort();

        return;
      }

      if (!opening.result.objectStoreNames.contains(STORE_NAME))
        opening.result.createObjectStore(STORE_NAME);
    };

    opening.onsuccess = () => {
      const db = opening.result;

      if (settled) {
        db.close();

        return;
      }

      settled = true;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.close();
        reject(new Error("Неподдерживаемая структура хранилища."));

        return;
      }

      try {
        const store = db
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME);

        if (store.keyPath !== null || store.autoIncrement)
          throw new Error(
            "Неподдерживаемая структура documents: данные оставлены без изменений.",
          );
      } catch (error) {
        db.close();
        reject(error);

        return;
      }

      let closed = false;
      let schema2Preserved = false;
      let schema3Preserved = false;
      const pending = new Set<Promise<unknown>>();

      const invalidate = (message: string) => {
        if (closed) return;

        closed = true;
        db.close();
        onInvalidated(message);
      };

      db.onversionchange = () =>
        invalidate(
          "Версия хранилища меняется в другой вкладке. Запись остановлена; повторите подключение.",
        );

      db.onclose = () =>
        invalidate(
          "Соединение с хранилищем закрыто. Повторите подключение; записи в памяти доступны для экспорта.",
        );

      function transaction<T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore, result: (value: T) => void) => void,
      ): Promise<T> {
        if (closed)
          return Promise.reject(new Error("Соединение с хранилищем закрыто."));

        let tx: IDBTransaction;

        try {
          tx = db.transaction(STORE_NAME, mode);
        } catch (error) {
          return Promise.reject(error);
        }

        const task = new Promise<T>((done, fail) => {
          let result: T;
          let failure: unknown;

          tx.oncomplete = () => {
            if (failure) fail(failure);
            else done(result);
          };

          tx.onabort = () =>
            fail(failure ?? tx.error ?? new Error("Транзакция отменена."));

          tx.onerror = () => {
            failure = tx.error ?? new Error("Ошибка транзакции IndexedDB.");
          };

          try {
            run(tx.objectStore(STORE_NAME), (value) => {
              result = value;
            });
          } catch (error) {
            failure = error;

            try {
              tx.abort();
            } catch {
              fail(error);
            }
          }
        });

        pending.add(task);

        void task.then(
          () => pending.delete(task),
          () => pending.delete(task),
        );

        return task;
      }

      function preserveSchema1(
        store: IDBObjectStore,
        candidate: BoardDocument,
      ) {
        if (candidate.schemaVersion !== 2 || schema2Preserved) return;

        const main = store.get(boardKey),
          backupKey = store.getKey(backupKeyFor("before-schema2"));

        let mainReady = false,
          backupReady = false;

        const preserve = () => {
          if (!mainReady || !backupReady) return;

          const raw: unknown = main.result;

          if (
            backupKey.result === undefined &&
            raw &&
            typeof raw === "object" &&
            "schemaVersion" in raw &&
            raw.schemaVersion === 1
          )
            store.put(raw, backupKeyFor("before-schema2"));
        };

        main.onsuccess = () => {
          mainReady = true;
          preserve();
        };

        backupKey.onsuccess = () => {
          backupReady = true;
          preserve();
        };
      }

      function preserveSchema3(
        store: IDBObjectStore,
        candidate: BoardDocument,
      ) {
        if (candidate.schemaVersion !== 3 || schema3Preserved) return;

        const main = store.get(boardKey),
          backup = store.getKey(backupKeyFor("before-schema3"));

        let mainReady = false,
          backupReady = false;

        const preserve = () => {
          if (!mainReady || !backupReady || backup.result !== undefined) return;

          const raw: unknown = main.result;

          if (
            raw &&
            typeof raw === "object" &&
            "schemaVersion" in raw &&
            (raw.schemaVersion === 1 || raw.schemaVersion === 2)
          )
            store.put(raw, backupKeyFor("before-schema3"));
        };

        main.onsuccess = () => {
          mainReady = true;
          preserve();
        };

        backup.onsuccess = () => {
          backupReady = true;
          preserve();
        };
      }

      function preserveSchema4(
        store: IDBObjectStore,
        candidate: BoardDocument,
      ) {
        if (candidate.schemaVersion !== 4) return;

        const main = store.get(boardKey),
          existing = store.getKey(backupKeyFor("before-schema4"));

        let loaded = false,
          checked = false;

        const preserve = () => {
          if (!loaded || !checked || existing.result !== undefined) return;

          const raw: unknown = main.result;

          if (
            raw &&
            typeof raw === "object" &&
            "schemaVersion" in raw &&
            [1, 2, 3].includes(raw.schemaVersion as number)
          )
            store.put(raw, backupKeyFor("before-schema4"));
        };

        main.onsuccess = () => {
          loaded = true;
          preserve();
        };

        existing.onsuccess = () => {
          checked = true;
          preserve();
        };
      }

      resolve({
        read: () =>
          transaction("readonly", (store, result) => {
            const values = {
              main: { exists: false, value: undefined as unknown },
              beforeImport: { exists: false, value: undefined as unknown },
              beforeSchema2: { exists: false, value: undefined as unknown },
              beforeSchema3: { exists: false, value: undefined as unknown },
              beforeSchema4: { exists: false, value: undefined as unknown },
              beforeLibrary: { exists: false, value: undefined as unknown },
            };

            for (const [name, key] of [
              ["beforeSchema4", backupKeyFor("before-schema4")],
              ["beforeLibrary", backupKeyFor("before-library")],
            ] as const) {
              const request = store.get(key),
                exists = store.getKey(key);

              request.onsuccess = () => {
                values[name].value = request.result as unknown;
              };

              exists.onsuccess = () => {
                values[name].exists = exists.result !== undefined;
              };
            }

            const schema3 = store.get(backupKeyFor("before-schema3")),
              schema3Key = store.getKey(backupKeyFor("before-schema3"));

            schema3.onsuccess = () => {
              values.beforeSchema3.value = schema3.result as unknown;
            };

            schema3Key.onsuccess = () => {
              values.beforeSchema3.exists = schema3Key.result !== undefined;
            };

            const main = store.get(boardKey);
            const mainKey = store.getKey(boardKey);
            const previous = store.get(backupKeyFor("before-import"));
            const previousKey = store.getKey(backupKeyFor("before-import"));
            const upgrade = store.get(backupKeyFor("before-schema2"));
            const upgradeKey = store.getKey(backupKeyFor("before-schema2"));

            upgrade.onsuccess = () => {
              values.beforeSchema2.value = upgrade.result as unknown;
            };

            upgradeKey.onsuccess = () => {
              values.beforeSchema2.exists = upgradeKey.result !== undefined;
            };

            main.onsuccess = () => {
              values.main.value = main.result as unknown;
            };

            mainKey.onsuccess = () => {
              values.main.exists = mainKey.result !== undefined;
            };

            previous.onsuccess = () => {
              values.beforeImport.value = previous.result as unknown;
            };

            previousKey.onsuccess = () => {
              values.beforeImport.exists = previousKey.result !== undefined;
            };

            result(values);
          }),

        write: (document: BoardDocument) => {
          const schema2 = document.schemaVersion === 2;

          return transaction<void>("readwrite", (store, result) => {
            preserveSchema4(store, document);
            preserveSchema1(store, document);
            preserveSchema3(store, document);

            store.put(
              document.schemaVersion === 4
                ? DocumentCodec.encodeDocument(document)
                : document,
              boardKey,
            );

            result(undefined);
          }).then(() => {
            schema2Preserved = schema2;
            schema3Preserved = document.schemaVersion === 3;
          });
        },

        replace: (previous: unknown, candidate: BoardDocument) => {
          const schema2 = candidate.schemaVersion === 2;

          return transaction<void>("readwrite", (store, result) => {
            preserveSchema4(store, candidate);
            preserveSchema1(store, candidate);
            preserveSchema3(store, candidate);

            store.put(
              previous &&
                typeof previous === "object" &&
                "strokes" in previous &&
                "schemaVersion" in previous &&
                previous.schemaVersion === 4
                ? DocumentCodec.encodeDocument(previous as BoardDocument)
                : previous,
              backupKeyFor("before-import"),
            );

            store.put(
              candidate.schemaVersion === 4
                ? DocumentCodec.encodeDocument(candidate)
                : candidate,
              boardKey,
            );

            result(undefined);
          }).then(() => {
            schema2Preserved = schema2;
            schema3Preserved = candidate.schemaVersion === 3;
          });
        },

        close: async () => {
          closed = true;
          await Promise.allSettled([...pending]);
          db.close();
        },
      });
    };
  });
}

export const DocumentRepositoryAdapter = {
  DATABASE_NAME,
  STORE_NAME,
  openRepository,
};
