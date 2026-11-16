import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { DocumentCodec } from "../modules/codec";
import type {
  BoardDocument,
  DocumentRepository,
} from "../board-document.types";

const DATABASE_NAME = "penable";
const STORE_NAME = "documents";

function openRepository(
  onInvalidated: (message: MessageTypes.Value) => void,
  factory: IDBFactory | undefined = globalThis.indexedDB,
  boardId = "main",
): Promise<DocumentRepository> {
  const boardKey = boardId === "main" ? "main" : `board:${boardId}`;

  const backupKeyFor = (name: string) =>
    boardId === "main" ? name : `${boardKey}:${name}`;

  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(boardId))
    return Promise.reject(
      Messages.error(Messages.create("invalidBoardIdentifier")),
    );

  if (!factory)
    return Promise.reject(
      Messages.error(Messages.create("indexeddbIsUnavailableInThisBrowser")),
    );

  return new Promise((resolve, reject) => {
    let settled = false;
    const opening = factory.open(DATABASE_NAME, 1);

    opening.onblocked = () => {
      settled = true;

      reject(
        Messages.error(
          Messages.create("anotherPageIsBlockingStorageAccessClose"),
        ),
      );
    };

    opening.onerror = () => {
      settled = true;

      reject(
        opening.error ??
          Messages.error(Messages.create("couldNotOpenIndexeddb")),
      );
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
        reject(Messages.error(Messages.create("unsupportedStorageStructure")));

        return;
      }

      try {
        const store = db
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME);

        if (store.keyPath !== null || store.autoIncrement)
          throw Messages.error(
            Messages.create(
              "unsupportedDocumentsStructureExistingDataIsUnchanged",
            ),
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

      const invalidate = (message: MessageTypes.Value) => {
        if (closed) return;

        closed = true;
        db.close();
        onInvalidated(message);
      };

      db.onversionchange = () =>
        invalidate(Messages.create("anotherTabIsChangingTheStorageVersion"));

      db.onclose = () =>
        invalidate(
          Messages.create("storageConnectionClosedReconnectNotesInMemory"),
        );

      function transaction<T>(
        mode: IDBTransactionMode,
        run: (store: IDBObjectStore, result: (value: T) => void) => void,
      ): Promise<T> {
        if (closed)
          return Promise.reject(
            Messages.error(Messages.create("storageConnectionClosed")),
          );

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
            fail(
              failure ??
                tx.error ??
                Messages.error(Messages.create("transactionCancelled")),
            );

          tx.onerror = () => {
            failure =
              tx.error ??
              Messages.error(Messages.create("indexeddbTransactionFailed"));
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
        if (candidate.schemaVersion !== 4 && candidate.schemaVersion !== 5)
          return;

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

      function preserveSchema5(
        store: IDBObjectStore,
        candidate: BoardDocument,
      ) {
        if (candidate.schemaVersion !== 5) return;

        const main = store.get(boardKey),
          existing = store.getKey(backupKeyFor("before-schema5"));

        let loaded = false,
          checked = false;

        const preserve = () => {
          if (!loaded || !checked || existing.result !== undefined) return;

          const raw: unknown = main.result;

          if (
            raw &&
            typeof raw === "object" &&
            "schemaVersion" in raw &&
            [1, 2, 3, 4].includes(raw.schemaVersion as number)
          )
            store.put(raw, backupKeyFor("before-schema5"));
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

      function replaceDocument(
        previous: unknown,
        candidate: BoardDocument,
        fromStored = false,
      ): Promise<void> {
        return transaction<void>("readwrite", (store, result) => {
          preserveSchema5(store, candidate);
          preserveSchema4(store, candidate);
          preserveSchema1(store, candidate);
          preserveSchema3(store, candidate);

          const savePrevious = (value: unknown) =>
            store.put(value, backupKeyFor("before-import"));

          if (fromStored) {
            const current = store.get(boardKey);

            current.onsuccess = () => {
              try {
                savePrevious(current.result as unknown);
              } catch {
                store.transaction.abort();
              }
            };
          } else
            savePrevious(
              previous &&
                typeof previous === "object" &&
                "strokes" in previous &&
                "schemaVersion" in previous &&
                (previous.schemaVersion === 4 || previous.schemaVersion === 5)
                ? DocumentCodec.encodeDocument(previous as BoardDocument)
                : previous,
            );

          store.put(
            candidate.schemaVersion === 4 || candidate.schemaVersion === 5
              ? DocumentCodec.encodeDocument(candidate)
              : candidate,
            boardKey,
          );

          result(undefined);
        }).then(() => {
          schema2Preserved = candidate.schemaVersion === 2;
          schema3Preserved = candidate.schemaVersion === 3;
        });
      }

      resolve({
        read: () =>
          transaction("readonly", (store, result) => {
            const values = {
              main: { exists: false, value: undefined as unknown },
              beforeImport: { exists: false, value: undefined as unknown },
              beforeSchema2: { exists: false, value: undefined as unknown },
              beforeSchema3: { exists: false, value: undefined as unknown },
              beforeSchema5: { exists: false, value: undefined as unknown },
              beforeSchema4: { exists: false, value: undefined as unknown },
              beforeLibrary: { exists: false, value: undefined as unknown },
            };

            for (const [name, key] of [
              ["beforeSchema5", backupKeyFor("before-schema5")],
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
          return transaction<void>("readwrite", (store, result) => {
            preserveSchema5(store, document);
            preserveSchema4(store, document);
            preserveSchema1(store, document);
            preserveSchema3(store, document);

            store.put(
              document.schemaVersion === 4 || document.schemaVersion === 5
                ? DocumentCodec.encodeDocument(document)
                : document,
              boardKey,
            );

            result(undefined);
          }).then(() => {
            schema2Preserved = document.schemaVersion === 2;
            schema3Preserved = document.schemaVersion === 3;
          });
        },

        replace: (previous, candidate) => replaceDocument(previous, candidate),
        replaceStored: (candidate) =>
          replaceDocument(undefined, candidate, true),

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
