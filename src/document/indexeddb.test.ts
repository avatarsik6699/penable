import { describe, expect, it, vi } from 'vitest'
import { openRepository } from './indexeddb'
import { emptyDocument } from './codec'

function request() {
  return { result: undefined as unknown, error: null as DOMException | null,
    onsuccess: null as (() => void) | null, onerror: null as (() => void) | null }
}

function fakeDatabase(keyPath: string | null = null, autoIncrement = false) {
  const transactions: ReturnType<typeof transaction>[] = []
  function transaction() {
    const reads = new Map<string, ReturnType<typeof request>>()
    const puts: Array<[unknown, IDBValidKey | undefined]> = []
    const store = {
      keyPath, autoIncrement,
      get: (key: string) => { const req = request(); reads.set(`value:${key}`, req); return req },
      getKey: (key: string) => { const req = request(); reads.set(`key:${key}`, req); return req },
      put: (value: unknown, key?: IDBValidKey) => { puts.push([value, key]); return request() },
    }
    return { objectStore: () => store, reads, puts,
      oncomplete: null as (() => void) | null, onabort: null as (() => void) | null,
      onerror: null as (() => void) | null, error: null as DOMException | null,
      abort() { this.onabort?.() } }
  }
  const db = {
    objectStoreNames: { contains: () => true },
    transaction: vi.fn(() => { const tx = transaction(); transactions.push(tx); return tx }),
    close: vi.fn(), onversionchange: null as (() => void) | null, onclose: null as (() => void) | null,
  }
  const opening = { result: db, error: null, onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null, onblocked: null as (() => void) | null, onupgradeneeded: null as (() => void) | null }
  const factory = { open: vi.fn(() => opening) } as unknown as IDBFactory
  const onInvalidated = vi.fn()
  const opened = openRepository(onInvalidated, factory)
  return { db, opening, transactions, opened, onInvalidated }
}

describe('native IndexedDB adapter transaction boundary', () => {
  it('resolves a write on transaction.complete, not request success, and rejects abort', async () => {
    const h = fakeDatabase()
    h.opening.onsuccess?.()
    const repository = await h.opened
    let settled = false
    const writing = repository.write(emptyDocument()).then(() => { settled = true })
    const tx = h.transactions.at(-1)!
    expect(tx.puts[0]?.[1]).toBe('main')
    await Promise.resolve()
    expect(settled).toBe(false)
    tx.oncomplete?.()
    await writing
    expect(settled).toBe(true)
    const aborted = repository.write(emptyDocument())
    const assertion = expect(aborted).rejects.toThrow()
    h.transactions.at(-1)!.onabort?.()
    await assertion
    await repository.close()
  })

  it('distinguishes missing main from stored null/undefined using key requests in the same transaction', async () => {
    const h = fakeDatabase()
    h.opening.onsuccess?.()
    const repository = await h.opened
    const reading = repository.read()
    const tx = h.transactions.at(-1)!
    const respond = (key: string, value: unknown) => { const req = tx.reads.get(key)!; req.result = value; req.onsuccess?.() }
    respond('key:main', 'main')
    respond('value:main', undefined)
    respond('key:before-import', undefined)
    respond('value:before-import', undefined)
    tx.oncomplete?.()
    expect(await reading).toEqual({ main: { exists: true, value: undefined }, beforeImport: { exists: false, value: undefined } })
    await repository.close()
  })

  it('enqueues backup and candidate puts in one transaction and closes on versionchange', async () => {
    const h = fakeDatabase()
    h.opening.onsuccess?.()
    const repository = await h.opened
    const candidate = emptyDocument()
    const replacing = repository.replace(null, candidate)
    const tx = h.transactions.at(-1)!
    expect(tx.puts).toEqual([[null, 'before-import'], [candidate, 'main']])
    tx.oncomplete?.()
    await replacing
    h.db.onversionchange?.()
    expect(h.db.close).toHaveBeenCalledOnce()
    expect(h.onInvalidated).toHaveBeenCalledOnce()
    await expect(repository.write(candidate)).rejects.toThrow('закрыто')
    await repository.close()
  })

  it.each([['id', false], [null, true]] as const)('rejects unknown keyPath/autoIncrement schema %s/%s', async (keyPath, autoIncrement) => {
    const h = fakeDatabase(keyPath, autoIncrement)
    const assertion = expect(h.opened).rejects.toThrow('структура')
    h.opening.onsuccess?.()
    await assertion
    expect(h.db.close).toHaveBeenCalledOnce()
  })

  it('rejects blocked opening and closes a late successful connection instead of exposing it', async () => {
    const h = fakeDatabase()
    const assertion = expect(h.opened).rejects.toThrow('заблокировано')
    h.opening.onblocked?.()
    await assertion
    h.opening.onsuccess?.()
    expect(h.db.close).toHaveBeenCalledOnce()
  })
})
