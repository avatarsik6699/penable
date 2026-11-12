import { useEffect, useRef, useState } from 'react'
import { DOCUMENT_LIMITS, documentStats, parseDocumentJSON } from '../document/codec'
import { messageOf } from '../document/session'
import type { BoardDocument, StorageState } from '../document/types'

interface StoragePanelProps {
  state: StorageState
  hasDocument: boolean
  busy: boolean
  onExport: () => string
  onPrevious: () => string
  onRetry: () => void
  onBeginImport: () => string
  onEndImport: () => void
  onConfirm: (document: BoardDocument) => Promise<void>
  onOverlayChange: () => void
}

const phaseLabels = { loading: 'Загрузка', dirty: 'Есть изменения', saving: 'Сохранение', saved: 'Сохранено', error: 'Ошибка' }

export function StoragePanel({ state, hasDocument, busy, onExport, onPrevious, onRetry, onBeginImport, onEndImport, onConfirm, onOverlayChange }: StoragePanelProps) {
  const [popoverOpen, setPopoverOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [candidate, setCandidate] = useState<BoardDocument | null>(null)
  const [reading, setReading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)
  const lifetime = useRef({ mounted: false, readGeneration: 0 })

  useEffect(() => {
    const current = lifetime.current
    current.mounted = true
    return () => { current.mounted = false; current.readGeneration++ }
  }, [])
  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    dialog?.showModal()
    return () => { dialog?.close() }
  }, [open])

  useEffect(() => { onOverlayChange() }, [popoverOpen, onOverlayChange])
  useEffect(() => {
    if (!popoverOpen) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !popoverRef.current?.contains(event.target)
        && !triggerRef.current?.contains(event.target)) setPopoverOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || dialogRef.current?.open) return
      event.preventDefault()
      event.stopPropagation()
      if (popoverRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true })
      setPopoverOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [popoverOpen])
  const feedback = (message: string) => { setNotice(message); setPopoverOpen(true) }

  const close = () => {
    if (confirming || state.importing) return
    lifetime.current.readGeneration++
    setOpen(false)
    setCandidate(null)
    setReading(false)
    setError('')
    onEndImport()
  }
  const begin = () => {
    const reason = onBeginImport()
    if (reason) { feedback(reason); return }
    setNotice('')
    setError('')
    setCandidate(null)
    setPopoverOpen(false)
    setOpen(true)
  }
  const readFile = async (file: File) => {
    const generation = ++lifetime.current.readGeneration
    setCandidate(null)
    setError('')
    if (file.size > DOCUMENT_LIMITS.bytes) { setReading(false); setError('Файл превышает 64 MiB.'); return }
    setReading(true)
    try {
      const document = parseDocumentJSON(await file.text())
      if (lifetime.current.mounted && generation === lifetime.current.readGeneration) setCandidate(document)
    } catch (error) {
      if (lifetime.current.mounted && generation === lifetime.current.readGeneration) setError(messageOf(error))
    } finally {
      if (lifetime.current.mounted && generation === lifetime.current.readGeneration) setReading(false)
    }
  }
  const confirm = async () => {
    if (!candidate || confirming) return
    setConfirming(true)
    setError('')
    try {
      await onConfirm(candidate)
      if (!lifetime.current.mounted) return
      setOpen(false)
      setCandidate(null)
      onEndImport()
      setPopoverOpen(true)
      setNotice('Доска заменена. Прежняя запись сохранена. Кнопка «Копия до замены» проверит возможность скачивания.')
    } catch (error) {
      if (lifetime.current.mounted) setError(messageOf(error))
    } finally {
      if (lifetime.current.mounted) setConfirming(false)
    }
  }

  return (
    <section className="storage-panel" aria-label="Локальное сохранение и копии">
      <div className="storage-row">
        <span className={`storage-status storage-status-${state.phase}`} role="status" aria-live="polite">
          {state.phase === 'error' ? phaseLabels.error : state.readOnly && state.loaded ? 'Только просмотр' : phaseLabels[state.phase]}
        </span>
        <span className="storage-local">Локально в этом браузере</span>
        <div className="storage-actions">
          <button type="button" disabled={!hasDocument} onClick={() => feedback(onExport())}>Скачать копию</button>
          <button type="button" disabled={!state.canImport || busy || state.importing} onClick={begin}>Импорт</button>
          <button ref={triggerRef} type="button" aria-expanded={popoverOpen} aria-controls="storage-popover"
            onClick={() => setPopoverOpen((value) => !value)}>Хранение</button>
        </div>
      </div>
      {popoverOpen && <div ref={popoverRef} id="storage-popover" className="storage-popover" role="region" aria-labelledby="storage-title">
        <div className="storage-popover-heading">
          <h2 id="storage-title">Хранение и копии</h2>
          <button type="button" onClick={() => { setPopoverOpen(false); triggerRef.current?.focus({ preventScroll: true }) }} aria-label="Закрыть сведения о хранении">Закрыть</button>
        </div>
        {state.message && <p className={state.phase === 'error' ? 'storage-error' : undefined}>{state.message}</p>}
        {notice && <p role="status">{notice}</p>}
        <div className="storage-recovery">
          {state.hasPrevious && <button type="button" title="Скачать JSON-копию до последней замены доски" onClick={() => feedback(onPrevious())}>Копия до замены</button>}
          {state.phase === 'error' && state.writable
            ? <button type="button" onClick={onRetry}>Повторить сохранение</button>
            : state.canReconnect && <button type="button" onClick={onRetry}>Повторить подключение</button>}
        </div>
        <p className="storage-help">Данные хранятся в этом профиле браузера, без облачной копии. Очистка данных сайта может удалить доску. Регулярно скачивайте JSON-копию. Незавершённый штрих в неё не входит. Скачивание передаёт файл браузеру; проверьте его в загрузках.</p>
      </div>}
      <dialog ref={dialogRef} className="storage-dialog" aria-labelledby="import-title"
        onCancel={(event) => { event.preventDefault(); close() }}>
        <h2 id="import-title">Импорт доски</h2>
        <p>Выберите JSON-копию. До подтверждения текущая доска останется прежней.</p>
        <label className="import-file">JSON-копия
          <input type="file" accept=".json,application/json" disabled={confirming || state.importing}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]
              event.currentTarget.value = ''
              if (file) void readFile(file)
            }} />
        </label>
        {reading && <p role="status">Проверка файла…</p>}
        {candidate && <p>В копии: {documentStats(candidate).strokes} штрихов, {documentStats(candidate).points} точек. Текущая доска будет заменена. Сохранится одна предыдущая запись; следующая замена перезапишет её. JSON-совместимую копию можно скачать, остальные данные останутся в хранилище.</p>}
        {error && <p className="storage-error" role="alert">{error}</p>}
        <div className="import-actions">
          <button type="button" onClick={close} disabled={confirming || state.importing}>Отмена</button>
          <button type="button" onClick={() => { void confirm() }} disabled={!candidate || reading || confirming || state.importing}>
            {confirming ? 'Замена…' : 'Заменить доску'}
          </button>
        </div>
      </dialog>
    </section>
  )
}
