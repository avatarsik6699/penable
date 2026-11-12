import { afterEach, describe, expect, it, vi } from 'vitest'
import { cloneDocument, emptyDocument } from './codec'
import { DocumentSession } from './session'
import type { BoardDocument, DocumentRepository, StoredRecord, WriterLease } from './types'
import type { Stroke } from '../drawing/types'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function setup(main: StoredRecord = { exists: true, value: emptyDocument() }, writer = true) {
  let live = emptyDocument()
  let invalidate: (message: string) => void = () => {}
  const repository = {
    read: vi.fn(async (): Promise<Awaited<ReturnType<DocumentRepository['read']>>> => ({ main, beforeImport: { exists: false, value: undefined } })),
    write: vi.fn(async (_document: BoardDocument) => {}),
    replace: vi.fn(async (_previous: unknown, _candidate: BoardDocument) => {}), close: vi.fn(async () => {}),
  }
  const lease: WriterLease = { acquired: writer, message: writer ? '' : 'Только просмотр', release: vi.fn(async () => {}) }
  const snapshot = vi.fn(() => cloneDocument(live))
  const onHydrate = vi.fn((document: BoardDocument) => { live = cloneDocument(document) })
  const onState = vi.fn()
  const session = new DocumentSession({ snapshot, onHydrate, onState,
    acquire: async () => lease, open: async (callback) => { invalidate = callback; return repository } })
  return { session, repository, lease, snapshot, onHydrate, onState,
    get live() { return live }, invalidate: (message: string) => invalidate(message) }
}

afterEach(() => { vi.useRealTimers() })

describe('serialized document session', () => {
  it('gates initial loading and only missing main creates defaults without any automatic write', async () => {
    const h = setup({ exists: false, value: undefined })
    const read = deferred<Awaited<ReturnType<DocumentRepository['read']>>>()
    h.repository.read.mockReturnValue(read.promise)
    const start = h.session.start()
    h.session.changed(true)
    expect(h.session.canWrite).toBe(false)
    await Promise.resolve()
    read.resolve({ main: { exists: false, value: undefined }, beforeImport: { exists: false, value: undefined } })
    await start
    expect(h.onHydrate).toHaveBeenCalledExactlyOnceWith(emptyDocument())
    expect(h.repository.write).not.toHaveBeenCalled()
    expect(h.snapshot).not.toHaveBeenCalled()
    expect(h.session.canWrite).toBe(true)
    expect(h.session.state.canReconnect).toBe(false)
    await h.session.dispose()
  })

  it.each([null, undefined, { format: 'other' }, { ...emptyDocument(), strokes: new Array<Stroke>(1) }])(
    'fails closed on an existing corrupt main record %j without hydrating/writing defaults', async (value) => {
      const h = setup({ exists: true, value })
      await h.session.start()
      h.session.changed(true)
      await h.session.flush()
      expect(h.session.state.phase).toBe('error')
      expect(h.session.canWrite).toBe(false)
      expect(h.session.canImport).toBe(true)
      expect(h.onHydrate).not.toHaveBeenCalled()
      expect(h.repository.write).not.toHaveBeenCalled()
      await h.session.dispose()
    },
  )

  it('captures only at flush, deduplicates status during pan updates and enforces debounce/max wait', async () => {
    vi.useFakeTimers()
    const h = setup()
    await h.session.start()
    h.onState.mockClear()
    for (let index = 0; index < 7; index++) {
      h.live.viewport.x = index
      h.session.changed()
      await vi.advanceTimersByTimeAsync(200)
    }
    expect(h.snapshot).not.toHaveBeenCalled()
    expect(h.onState).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(h.repository.write).toHaveBeenCalledTimes(1)
    expect(h.repository.write.mock.calls[0]?.[0].viewport.x).toBe(6)
    expect(h.session.state.phase).toBe('saved')
    h.live.tools.width = 1.2
    h.session.changed()
    await vi.advanceTimersByTimeAsync(299)
    expect(h.repository.write).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(h.repository.write).toHaveBeenCalledTimes(2)
    await h.session.dispose()
  })

  it('serializes writes, isolates snapshots, and never acknowledges a newer revision with an old completion', async () => {
    const h = setup()
    await h.session.start()
    const first = deferred<void>()
    h.repository.write.mockImplementationOnce(() => first.promise)
    h.live.tools.width = 1.2
    h.session.changed(true)
    const pending = h.session.flush()
    await Promise.resolve()
    expect(h.session.state.phase).toBe('saving')
    h.live.tools.width = 2.4
    h.session.changed(true)
    expect(h.repository.write.mock.calls[0]?.[0].tools.width).toBe(1.2)
    first.resolve()
    await pending
    expect(h.session.state.phase).toBe('dirty')
    expect(h.session.hasUnsaved).toBe(true)
    await h.session.flush()
    expect(h.repository.write.mock.calls[1]?.[0].tools.width).toBe(2.4)
    expect(h.session.state.phase).toBe('saved')
    await h.session.dispose()
  })

  it('pauses failed saving without retry spin; explicit retry saves current memory', async () => {
    vi.useFakeTimers()
    const h = setup()
    await h.session.start()
    h.repository.write.mockRejectedValueOnce(new Error('quota'))
    h.live.tools.width = 0.7
    h.session.changed(true)
    await h.session.flush()
    expect(h.session.state.phase).toBe('error')
    expect(h.session.hasUnsaved).toBe(true)
    h.live.tools.width = 1.2
    h.session.changed(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(h.repository.write).toHaveBeenCalledTimes(1)
    expect(h.live.tools.width).toBe(1.2)
    await h.session.retrySave()
    expect(h.repository.write.mock.calls[1]?.[0].tools.width).toBe(1.2)
    expect(h.session.state.phase).toBe('saved')
    await h.session.dispose()
  })

  it('keeps secondary/missing-lock sessions read-only without autosaving temporary view changes', async () => {
    const h = setup(undefined, false)
    await h.session.start()
    h.live.viewport.x = 100
    h.session.changed(true)
    await h.session.flush()
    expect(h.session.state.readOnly).toBe(true)
    expect(h.session.state.canReconnect).toBe(true)
    expect(h.session.canImport).toBe(false)
    expect(h.repository.write).not.toHaveBeenCalled()
    expect(h.snapshot).not.toHaveBeenCalled()
    await h.session.dispose()
  })

  it('retains dirty memory and disallows reconnect after version invalidation', async () => {
    const h = setup()
    await h.session.start()
    h.live.tools.width = 0.7
    h.session.changed()
    h.invalidate('versionchange')
    expect(h.session.canWrite).toBe(false)
    expect(h.session.state.canReconnect).toBe(false)
    expect(h.session.state.message).toContain('Скачайте')
    expect(h.live.tools.width).toBe(0.7)
    await h.session.flush()
    expect(h.repository.write).not.toHaveBeenCalled()
    await h.session.dispose()
  })

  it('waits for write drain and DB close before releasing the lease; late acknowledgements stay disposed', async () => {
    const h = setup()
    await h.session.start()
    const write = deferred<void>()
    const close = deferred<void>()
    const closeStarted = deferred<void>()
    h.repository.write.mockReturnValue(write.promise)
    h.repository.close.mockImplementation(() => { closeStarted.resolve(); return close.promise })
    h.session.changed(true)
    void h.session.flush()
    await Promise.resolve()
    const states = h.onState.mock.calls.length
    const disposal = h.session.dispose()
    expect(h.session.canWrite).toBe(false)
    expect(h.repository.close).not.toHaveBeenCalled()
    expect(h.lease.release).not.toHaveBeenCalled()
    write.resolve()
    await closeStarted.promise
    expect(h.repository.close).toHaveBeenCalledOnce()
    expect(h.lease.release).not.toHaveBeenCalled()
    close.resolve()
    await disposal
    expect(h.lease.release).toHaveBeenCalledOnce()
    expect(h.onState.mock.calls.length).toBe(states)
  })

  it('releases a late-acquired lease after disposal without opening or hydrating', async () => {
    const acquired = deferred<WriterLease>()
    const lease = { acquired: true, message: '', release: vi.fn(async () => {}) }
    const open = vi.fn()
    const hydrate = vi.fn()
    const session = new DocumentSession({ snapshot: emptyDocument, onHydrate: hydrate, onState: vi.fn(), acquire: () => acquired.promise, open })
    void session.start()
    const disposed = session.dispose()
    acquired.resolve(lease)
    await disposed
    expect(open).not.toHaveBeenCalled()
    expect(hydrate).not.toHaveBeenCalled()
    expect(lease.release).toHaveBeenCalledOnce()
  })

  it('ignores a load resolving after disposal and safely closes its repository', async () => {
    const h = setup()
    const read = deferred<Awaited<ReturnType<DocumentRepository['read']>>>()
    h.repository.read.mockReturnValue(read.promise)
    const starting = h.session.start()
    await Promise.resolve()
    await Promise.resolve()
    const disposal = h.session.dispose()
    read.resolve({ main: { exists: true, value: emptyDocument() }, beforeImport: { exists: false, value: undefined } })
    await starting
    await disposal
    expect(h.onHydrate).not.toHaveBeenCalled()
    expect(h.repository.close).toHaveBeenCalledOnce()
  })

  it('imports only after drain, backs up current unsaved memory, and hydrates only after atomic completion', async () => {
    const h = setup()
    await h.session.start()
    const writing = deferred<void>()
    const replacement = deferred<void>()
    const replaceStarted = deferred<void>()
    h.repository.write.mockReturnValueOnce(writing.promise)
    h.repository.replace.mockImplementationOnce(() => { replaceStarted.resolve(); return replacement.promise })
    h.session.changed(true)
    void h.session.flush()
    await Promise.resolve()
    h.live.tools.width = 0.7
    h.session.changed()
    const candidate = emptyDocument()
    candidate.background = 'dots'
    const importing = h.session.replace(candidate, () => false)
    expect(h.session.canWrite).toBe(false)
    expect(h.repository.replace).not.toHaveBeenCalled()
    writing.resolve()
    await replaceStarted.promise
    expect(h.repository.replace.mock.calls[0]?.[0]).toMatchObject({ tools: { width: 0.7 } })
    expect(h.onHydrate).toHaveBeenCalledTimes(1)
    replacement.resolve()
    await importing
    expect(h.onHydrate).toHaveBeenCalledTimes(2)
    expect(h.live.background).toBe('dots')
    expect(h.session.previousRecord.exists).toBe(true)
    expect(h.session.state.phase).toBe('saved')
    await h.session.dispose()
  })

  it('preserves live memory/dirty state when replacement fails and refuses busy confirmation', async () => {
    const h = setup()
    await h.session.start()
    h.live.tools.width = 1.2
    h.session.changed()
    await expect(h.session.replace(emptyDocument(), () => true)).rejects.toThrow()
    expect(h.repository.replace).not.toHaveBeenCalled()
    h.repository.replace.mockRejectedValueOnce(new Error('abort'))
    await expect(h.session.replace(emptyDocument(), () => false)).rejects.toThrow('abort')
    expect(h.live.tools.width).toBe(1.2)
    expect(h.session.hasUnsaved).toBe(true)
    expect(h.onHydrate).toHaveBeenCalledTimes(1)
    expect(h.session.previousRecord.exists).toBe(false)
    await h.session.dispose()
  })

  it.each([null, undefined, { format: 'corrupt' }])('recovers a corrupt stored value %j while backing up that exact raw value', async (raw) => {
    const h = setup({ exists: true, value: raw })
    await h.session.start()
    await h.session.replace(emptyDocument(), () => false)
    expect(h.repository.replace.mock.calls[0]?.[0]).toBe(raw)
    expect(h.session.previousRecord).toEqual({ exists: true, value: raw })
    expect(h.onHydrate).toHaveBeenCalledTimes(1)
    await h.session.dispose()
  })
})
