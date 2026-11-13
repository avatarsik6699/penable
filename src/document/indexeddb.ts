import type { BoardDocument, DocumentRepository } from './types'

export const DATABASE_NAME = 'penable'
export const STORE_NAME = 'documents'

export function openRepository(onInvalidated: (message: string) => void, factory: IDBFactory | undefined = globalThis.indexedDB): Promise<DocumentRepository> {
  if (!factory) return Promise.reject(new Error('IndexedDB недоступен в этом браузере.'))
  return new Promise((resolve, reject) => {
    let settled = false
    const opening = factory.open(DATABASE_NAME, 1)
    opening.onblocked = () => { settled = true; reject(new Error('Открытие хранилища заблокировано другой страницей. Закройте её и повторите.')) }
    opening.onerror = () => { settled = true; reject(opening.error ?? new Error('Не удалось открыть IndexedDB.')) }
    opening.onupgradeneeded = () => {
      if (settled) { opening.transaction?.abort(); return }
      if (!opening.result.objectStoreNames.contains(STORE_NAME)) opening.result.createObjectStore(STORE_NAME)
    }
    opening.onsuccess = () => {
      const db = opening.result
      if (settled) { db.close(); return }
      settled = true
      if (!db.objectStoreNames.contains(STORE_NAME)) { db.close(); reject(new Error('Неподдерживаемая структура хранилища.')); return }
      try {
        const store = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME)
        if (store.keyPath !== null || store.autoIncrement) throw new Error('Неподдерживаемая структура documents: данные оставлены без изменений.')
      } catch (error) { db.close(); reject(error); return }
      let closed = false
      let schema2Preserved = false
      const pending = new Set<Promise<unknown>>()
      const invalidate = (message: string) => { if (closed) return; closed = true; db.close(); onInvalidated(message) }
      db.onversionchange = () => invalidate('Версия хранилища меняется в другой вкладке. Запись остановлена; повторите подключение.')
      db.onclose = () => invalidate('Соединение с хранилищем закрыто. Повторите подключение; записи в памяти доступны для экспорта.')

      function transaction<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
        if (closed) return Promise.reject(new Error('Соединение с хранилищем закрыто.'))
        let tx: IDBTransaction
        try { tx = db.transaction(STORE_NAME, mode) } catch (error) { return Promise.reject(error) }
        const task = new Promise<T>((done, fail) => {
          let result: T
          let failure: unknown
          tx.oncomplete = () => { if (failure) fail(failure); else done(result) }
          tx.onabort = () => fail(failure ?? tx.error ?? new Error('Транзакция отменена.'))
          tx.onerror = () => { failure = tx.error ?? new Error('Ошибка транзакции IndexedDB.') }
          try { run(tx.objectStore(STORE_NAME), (value) => { result = value }) } catch (error) {
            failure = error
            try { tx.abort() } catch { fail(error) }
          }
        })
        pending.add(task)
        void task.then(() => pending.delete(task), () => pending.delete(task))
        return task
      }
      function preserveSchema1(store: IDBObjectStore, candidate: BoardDocument) {
        if (candidate.schemaVersion !== 2 || schema2Preserved) return
        const main = store.get('main'), backupKey = store.getKey('before-schema2')
        let mainReady = false, backupReady = false
        const preserve = () => {
          if (!mainReady || !backupReady) return
          const raw: unknown = main.result
          if (backupKey.result === undefined && raw && typeof raw === 'object'
            && 'schemaVersion' in raw && raw.schemaVersion === 1) store.put(raw, 'before-schema2')
        }
        main.onsuccess = () => { mainReady = true; preserve() }
        backupKey.onsuccess = () => { backupReady = true; preserve() }
      }
      resolve({
        read: () => transaction('readonly', (store, result) => {
          const values = { main: { exists: false, value: undefined as unknown }, beforeImport: { exists: false, value: undefined as unknown }, beforeSchema2: { exists: false, value: undefined as unknown } }
          const main = store.get('main')
          const mainKey = store.getKey('main')
          const previous = store.get('before-import')
          const previousKey = store.getKey('before-import')
          const upgrade = store.get('before-schema2')
          const upgradeKey = store.getKey('before-schema2')
          upgrade.onsuccess = () => { values.beforeSchema2.value = upgrade.result as unknown }
          upgradeKey.onsuccess = () => { values.beforeSchema2.exists = upgradeKey.result !== undefined }
          main.onsuccess = () => { values.main.value = main.result as unknown }
          mainKey.onsuccess = () => { values.main.exists = mainKey.result !== undefined }
          previous.onsuccess = () => { values.beforeImport.value = previous.result as unknown }
          previousKey.onsuccess = () => { values.beforeImport.exists = previousKey.result !== undefined }
          result(values)
        }),
        write: (document: BoardDocument) => {
          const schema2 = document.schemaVersion === 2
          return transaction<void>('readwrite', (store, result) => {
          preserveSchema1(store, document)
          store.put(document, 'main'); result(undefined)
          }).then(() => { schema2Preserved = schema2 })
        },
        replace: (previous: unknown, candidate: BoardDocument) => {
          const schema2 = candidate.schemaVersion === 2
          return transaction<void>('readwrite', (store, result) => {
          preserveSchema1(store, candidate)
          store.put(previous, 'before-import')
          store.put(candidate, 'main')
          result(undefined)
          }).then(() => { schema2Preserved = schema2 })
        },
        close: async () => { closed = true; await Promise.allSettled([...pending]); db.close() },
      })
    }
  })
}
