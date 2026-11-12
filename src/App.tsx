import { useCallback, useEffect, useRef, useState } from 'react'
import { PenToolbar } from './components/PenToolbar'
import { WritingSurface } from './components/WritingSurface'
import { validDpr } from './drawing/coordinates'
import type { DrawingTool, HistoryState, InputDiagnostics, SurfaceControls } from './drawing/types'
import { DEFAULT_STABILIZATION_STRENGTH, normalizeStrength } from './drawing/stabilization'
import type { BackgroundMode } from './drawing/background'
import { StoragePanel } from './components/StoragePanel'
import { cloneDocument, serializeDocument, serializeRawBackup } from './document/codec'
import { DocumentSession, messageOf } from './document/session'
import type { BoardDocument, StorageState } from './document/types'

const INITIAL_STORAGE: StorageState = { phase: 'loading', loaded: false, writable: false, readOnly: true,
  canImport: false, importing: false, hasPrevious: false, canReconnect: false, message: '' }

function downloadJSON(json: string, name: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  try { link.click() } finally { link.remove(); URL.revokeObjectURL(url) }
}

export default function App() {
  const [tool, setTool] = useState<DrawingTool>('pen')
  const toolRef = useRef<DrawingTool>('pen')
  const [width, setWidth] = useState(3)
  const [strengthValue, setStabilization] = useState(DEFAULT_STABILIZATION_STRENGTH)
  const stabilization = normalizeStrength(strengthValue)
  const [unavailable, setUnavailable] = useState('')
  const [background, setBackground] = useState<BackgroundMode>('blank')
  const [historyState, setHistoryState] = useState<HistoryState>({ canUndo: false, canRedo: false, busy: false })
  const controlsRef = useRef<SurfaceControls | null>(null)
  const [storage, setStorage] = useState<StorageState>(INITIAL_STORAGE)
  const [board, setBoard] = useState<{ document: BoardDocument; generation: number } | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const dialogBlocked = useRef(false)
  const toolsRef = useRef({ width: 3, stabilization: DEFAULT_STABILIZATION_STRENGTH })
  const backgroundValue = useRef<BackgroundMode>('blank')
  const latestDocument = useRef<BoardDocument | null>(null)
  const generation = useRef(0)
  const sessionRef = useRef<DocumentSession | null>(null)
  const priorDisposal = useRef<Promise<void>>(Promise.resolve())
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() => ({
    pointerType: null, pressure: null, active: false,
    dpr: validDpr(window.devicePixelRatio),
    coalesced: typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function',
    zoom: 1, nativeScale: validDpr(window.visualViewport?.scale ?? 1),
    requestedRatio: 1, effectiveRatio: 1, bitmapWidth: 0, bitmapHeight: 0, resolutionCapped: false,
  }))

  const snapshot = useCallback((): BoardDocument => {
    const initial = latestDocument.current
    if (!initial) throw new Error('Доска ещё не загружена.')
    const scene = controlsRef.current?.snapshot()
    return cloneDocument({ format: 'penable-board', schemaVersion: 1, strokes: scene?.strokes ?? initial.strokes,
      viewport: scene?.viewport ?? initial.viewport, background: backgroundValue.current,
      tools: { width: toolsRef.current.width, stabilization: toolsRef.current.stabilization } })
  }, [])
  const canWrite = useCallback(() => Boolean(sessionRef.current?.canWrite && controlsRef.current && !dialogBlocked.current), [])
  const getTool = useCallback(() => toolRef.current, [])
  const interactionsBlocked = useCallback(() => dialogBlocked.current, [])
  const documentChanged = useCallback((urgent: boolean) => { sessionRef.current?.changed(urgent) }, [])

  useEffect(() => {
    let active = true
    const session = new DocumentSession({
      snapshot,
      onHydrate: (document) => {
        if (!active || sessionRef.current !== session) return
        controlsRef.current?.cancelInput()
        controlsRef.current = null
        toolRef.current = 'pen'
        setTool('pen')
        latestDocument.current = document
        toolsRef.current = { width: document.tools.width, stabilization: document.tools.stabilization }
        backgroundValue.current = document.background
        setWidth(document.tools.width)
        setStabilization(document.tools.stabilization)
        setBackground(document.background)
        setUnavailable('')
        setHistoryState({ canUndo: false, canRedo: false, busy: false })
        setBoard({ document, generation: ++generation.current })
      },
      onState: (state) => {
        if (!active || sessionRef.current !== session) return
        if (!state.writable) controlsRef.current?.cancelInput()
        setStorage(state)
      },
    })
    sessionRef.current = session
    const starting = priorDisposal.current.then(() => { if (active) return session.start() })
    return () => {
      active = false
      const disposal = session.dispose()
      priorDisposal.current = Promise.allSettled([starting, disposal]).then(() => {})
    }
  }, [attempt, snapshot])

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!sessionRef.current?.hasUnsaved) return
      event.preventDefault()
      event.returnValue = ''
    }
    const visibility = () => { if (document.visibilityState === 'hidden') void sessionRef.current?.flush() }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  const changeTool = (value: DrawingTool) => {
    if (!canWrite() || controlsRef.current?.isBusy()) return
    toolRef.current = value
    setTool(value)
  }
  const changeWidth = (value: number) => {
    if (!canWrite()) return
    toolsRef.current = { width: value, stabilization: toolsRef.current.stabilization }
    setWidth(value)
    documentChanged(false)
  }
  const changeStabilization = (value: number) => {
    if (!canWrite()) return
    toolsRef.current = { width: toolsRef.current.width, stabilization: value }
    setStabilization(value)
    documentChanged(false)
  }
  const changeBackground = (value: BackgroundMode) => {
    if (!canWrite()) return
    backgroundValue.current = value
    setBackground(value)
    documentChanged(false)
  }
  const endImport = () => { dialogBlocked.current = false; setDialogOpen(false) }
  const beginImport = () => {
    if (!sessionRef.current?.canImport || controlsRef.current?.isBusy()) return 'Завершите письмо, стирание или перемещение перед импортом.'
    dialogBlocked.current = true
    setDialogOpen(true)
    return ''
  }
  const confirmImport = async (candidate: BoardDocument) => {
    const session = sessionRef.current
    if (!session) throw new Error('Хранилище ещё не открыто.')
    await session.replace(candidate, () => controlsRef.current?.isBusy() ?? false)
  }
  const exportCurrent = () => {
    try {
      const result = serializeDocument(snapshot())
      downloadJSON(result.json, 'penable-board.json')
      return result.warning || 'Копия передана браузеру для скачивания. Проверьте файл в загрузках.'
    } catch (error) { return messageOf(error) }
  }
  const exportPrevious = () => {
    try {
      const record = sessionRef.current?.previousRecord
      if (!record?.exists) throw new Error('Копии до замены пока нет.')
      const json = serializeRawBackup(record.value)
      downloadJSON(json, 'penable-before-import.json')
      return 'Копия до замены передана браузеру. Повреждённая исходная запись может не поддерживать обратный импорт.'
    } catch (error) { return messageOf(error) }
  }
  const retry = () => {
    const session = sessionRef.current
    if (session?.canWrite) { void session.retrySave(); return }
    if (!session?.hasUnsaved && session?.state.canReconnect) setAttempt((value) => value + 1)
  }

  return (
    <main className="app">
      <PenToolbar tool={tool} onToolChange={changeTool} width={width} onWidthChange={changeWidth} diagnostics={diagnostics}
        stabilization={stabilization} onStabilizationChange={changeStabilization}
        background={background} onBackgroundChange={changeBackground} historyState={historyState}
        readOnly={!storage.writable || dialogOpen || !board || Boolean(unavailable)}
        onUndo={() => controlsRef.current?.undo()} onRedo={() => controlsRef.current?.redo()}
        onZoomIn={() => controlsRef.current?.zoomIn()} onZoomOut={() => controlsRef.current?.zoomOut()}
        onResetView={() => controlsRef.current?.reset()} />
      <StoragePanel state={storage} hasDocument={Boolean(board)} busy={historyState.busy} onExport={exportCurrent}
        onPrevious={exportPrevious} onRetry={retry} onBeginImport={beginImport} onEndImport={endImport} onConfirm={confirmImport} />
      {!board ? <div className="load-state" role="status">{storage.phase === 'loading' ? 'Загрузка доски…' : 'Доска не загружена. Повторите подключение или восстановите её из копии.'}</div> : unavailable ? (
        <div className="capability-error" role="alert">
          <h2>Не удалось открыть лист</h2>
          <p>{unavailable} Откройте страницу в актуальной версии Chrome или Edge.</p>
        </div>
      ) : <WritingSurface key={board.generation} initialDocument={board.document} tool={tool} getTool={getTool} width={width} stabilization={stabilization}
        background={background} canWrite={canWrite} interactionsBlocked={interactionsBlocked} onDocumentChange={documentChanged}
        onHistoryState={setHistoryState} controlsRef={controlsRef} onDiagnostics={setDiagnostics} onUnavailable={setUnavailable} />}
    </main>
  )
}
