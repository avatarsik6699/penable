import { useEffect, useRef, type RefObject } from 'react'
import { validDpr } from '../drawing/coordinates'
import { EraserInput } from '../drawing/eraser'
import { PenInput } from '../drawing/input'
import { CanvasRenderer } from '../drawing/renderer'
import type { DrawingTool, HistoryState, InputDiagnostics, Scene, SurfaceControls } from '../drawing/types'
import { BoardNavigation, initialViewport } from '../drawing/viewport'
import { StrokeHistory } from '../drawing/history'
import { historyShortcut, type HistoryAction } from '../drawing/shortcuts'
import { backgroundLayout, type BackgroundMode } from '../drawing/background'
import { cloneDocument } from '../document/codec'
import type { BoardDocument } from '../document/types'
import { allocateStrokeId } from '../document/stroke-ids'

interface WritingSurfaceProps {
  tool: DrawingTool
  getTool: () => DrawingTool
  width: number
  stabilization: number
  background: BackgroundMode
  initialDocument: BoardDocument
  canWrite: () => boolean
  interactionsBlocked: () => boolean
  onDocumentChange: (urgent: boolean) => void
  onHistoryState: (state: HistoryState) => void
  onDiagnostics: (value: InputDiagnostics) => void
  onUnavailable: (reason: string) => void
  controlsRef: RefObject<SurfaceControls | null>
}

export function WritingSurface({ tool, getTool, width, stabilization, background, initialDocument, canWrite, interactionsBlocked,
  onDocumentChange, onHistoryState, onDiagnostics, onUnavailable, controlsRef }: WritingSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const completedRef = useRef<HTMLCanvasElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(width)
  const stabilizationRef = useRef(stabilization)
  const sceneRef = useRef<Scene>({ strokes: [], active: null })
  const historyRef = useRef<StrokeHistory | null>(null)
  const historyStateRef = useRef<HistoryState | null>(null)
  const viewportRef = useRef(initialViewport())
  const hydratedRef = useRef(false)

  useEffect(() => { widthRef.current = width }, [width])
  useEffect(() => { stabilizationRef.current = stabilization }, [stabilization])

  useEffect(() => {
    const canvas = canvasRef.current
    const completedCanvas = completedRef.current
    if (!canvas || !completedCanvas) return
    let context: CanvasRenderingContext2D | null = null
    let completedContext: CanvasRenderingContext2D | null = null
    try {
      context = canvas.getContext('2d')
      completedContext = completedCanvas.getContext('2d')
    } catch { /* Report the same capability fallback below. */ }
    if (!context || !completedContext || typeof PointerEvent === 'undefined') {
      onUnavailable(!context || !completedContext ? 'В этом браузере недоступен Canvas 2D.' : 'В этом браузере недоступны Pointer Events.')
      return
    }

    const scene = sceneRef.current
    if (!hydratedRef.current) {
      const initial = cloneDocument(initialDocument)
      scene.strokes = initial.strokes
      viewportRef.current = initial.viewport
      hydratedRef.current = true
    }
    const history = historyRef.current ?? new StrokeHistory(scene.strokes, scene.strokes.length)
    historyRef.current = history
    const visualViewport = window.visualViewport
    const renderer = new CanvasRenderer(
      { canvas: completedCanvas, context: completedContext }, { canvas, context }, scene, viewportRef.current,
    )
    const updateBackground = () => {
      const style = backgroundRef.current?.style
      if (!style) return
      const layout = backgroundLayout(viewportRef.current)
      style.setProperty('--background-step', `${layout.screenStep}px`)
      style.setProperty('--background-x', `${layout.phaseX}px`)
      style.setProperty('--background-y', `${layout.phaseY}px`)
      style.setProperty('--background-dot-x', `${layout.phaseX - layout.screenStep / 2}px`)
      style.setProperty('--background-dot-y', `${layout.phaseY - layout.screenStep / 2}px`)
    }
    const input = new PenInput({
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      viewport: () => viewportRef.current,
      width: () => widthRef.current,
      stabilization: () => stabilizationRef.current,
      allocateId: () => allocateStrokeId(scene.strokes),
      onActiveChange: () => renderer.activeChanged(),
      onCommit: (stroke) => {
        if (!canWrite()) { renderer.activeChanged(); return }
        history.commit(stroke)
        renderer.commit(stroke)
        publishHistoryState()
        onDocumentChange(true)
      },
    })
    const eraser = new EraserInput({
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      viewport: () => viewportRef.current,
      onPreviewChange: () => renderer.setEraserPreview(eraser.preview),
      onCommit: (strokes) => {
        if (!canWrite() || interactionsBlocked()) return
        if (history.erase(strokes)) onDocumentChange(true)
      },
    })
    const drawingPointerId = () => input.pointerId ?? eraser.pointerId
    const activeInput = () => eraser.pointerId !== null ? eraser : input
    let diagnostics: InputDiagnostics = {
      pointerType: null, pressure: null, active: false,
      dpr: validDpr(window.devicePixelRatio),
      coalesced: typeof PointerEvent.prototype.getCoalescedEvents === 'function',
      zoom: viewportRef.current.zoom, nativeScale: validDpr(visualViewport?.scale ?? 1),
      requestedRatio: 1, effectiveRatio: 1, bitmapWidth: 0, bitmapHeight: 0, resolutionCapped: false,
    }
    let diagnosticsTimer: ReturnType<typeof setTimeout> | undefined
    const scheduleDiagnostics = () => {
      if (diagnosticsTimer !== undefined) return
      diagnosticsTimer = setTimeout(() => {
        diagnosticsTimer = undefined
        onDiagnostics({ ...diagnostics })
      }, 100)
    }
    const observeInput = (event?: PointerEvent) => {
      diagnostics = {
        ...diagnostics,
        ...(event ? {
          pointerType: event.pointerType || 'не указан',
          pressure: Number.isFinite(event.pressure) ? event.pressure : null,
          coalesced: typeof event.getCoalescedEvents === 'function',
        } : {}),
        active: drawingPointerId() !== null,
      }
      scheduleDiagnostics()
    }
    const navigation = new BoardNavigation({
      viewport: viewportRef.current,
      isDrawing: () => drawingPointerId() !== null,
      onChange: (viewport) => {
        viewportRef.current = viewport
        renderer.setViewport(viewport)
        updateBackground()
        diagnostics = { ...diagnostics, zoom: viewport.zoom }
        scheduleDiagnostics()
        if (canWrite()) onDocumentChange(false)
      },
    })
    let disposed = false
    const publishHistoryState = () => {
      if (disposed) return
      const next = {
        canUndo: history.canUndo, canRedo: history.canRedo,
        busy: drawingPointerId() !== null || navigation.pointerId !== null,
      }
      const previous = historyStateRef.current
      if (previous && previous.canUndo === next.canUndo && previous.canRedo === next.canRedo && previous.busy === next.busy) return
      historyStateRef.current = next
      onHistoryState(next)
    }
    const applyHistory = (action: HistoryAction) => {
      if (!canWrite() || interactionsBlocked() || drawingPointerId() !== null || navigation.pointerId !== null) return
      if (action === 'undo' ? history.undo() : history.redo()) {
        renderer.sceneChanged()
        publishHistoryState()
        onDocumentChange(true)
      }
    }
    let spaceDown = false
    const updateCursor = () => {
      canvas.dataset.panReady = String(spaceDown && drawingPointerId() === null)
      canvas.dataset.panning = String(navigation.pointerId !== null)
    }
    const releaseCapture = (pointerId: number | null) => {
      if (pointerId === null) return
      try {
        if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId)
      } catch { /* Synthetic events have no native pointer to capture or release. */ }
    }
    const cancel = () => {
      const pointerId = drawingPointerId() ?? navigation.pointerId
      input.cancel()
      eraser.cancel()
      navigation.endPan()
      releaseCapture(pointerId)
      updateCursor()
      observeInput()
      publishHistoryState()
    }
    const down = (event: PointerEvent) => {
      if (interactionsBlocked()) return
      if (navigation.startPan(event, spaceDown)
        || (canWrite() && navigation.pointerId === null && !spaceDown && (getTool() === 'eraser' ? eraser : input).down(event))) {
        event.preventDefault()
        canvas.focus({ preventScroll: true })
        try { canvas.setPointerCapture?.(event.pointerId) } catch { /* Window listeners are the fallback. */ }
      }
      if (event.button === 1) event.preventDefault()
      updateCursor()
      observeInput(event)
      publishHistoryState()
    }
    const move = (event: PointerEvent) => {
      if ((!canWrite() && drawingPointerId() !== null) || interactionsBlocked()) { cancel(); return }
      const panPointer = navigation.pointerId
      if (navigation.movePan(event)) {
        event.preventDefault()
        if (navigation.pointerId === null) {
          releaseCapture(panPointer)
          publishHistoryState()
        }
        updateCursor()
        observeInput(event)
        return
      }
      const pointerId = drawingPointerId()
      if (activeInput().move(event)) event.preventDefault()
      if (pointerId !== null && drawingPointerId() === null) {
        releaseCapture(pointerId)
        publishHistoryState()
      }
      updateCursor()
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const up = (event: PointerEvent) => {
      if ((!canWrite() && drawingPointerId() !== null) || interactionsBlocked()) { cancel(); return }
      if (navigation.endPan(event.pointerId)) {
        event.preventDefault()
        releaseCapture(event.pointerId)
        updateCursor()
        observeInput(event)
        publishHistoryState()
        return
      }
      const pointerId = drawingPointerId()
      if (activeInput().up(event)) {
        event.preventDefault()
        releaseCapture(event.pointerId)
        publishHistoryState()
      }
      updateCursor()
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== drawingPointerId() && event.pointerId !== navigation.pointerId) return
      cancel()
      observeInput(event)
    }
    const lostCapture = (event: PointerEvent) => {
      const panEnded = navigation.endPan(event.pointerId)
      const inkEnded = input.cancel(event.pointerId)
      const eraseEnded = eraser.cancel(event.pointerId)
      if (panEnded || inkEnded || eraseEnded) {
        updateCursor()
        observeInput(event)
        publishHistoryState()
      }
    }
    const contextMenu = (event: MouseEvent) => event.preventDefault()
    const wheel = (event: WheelEvent) => {
      if (!event.cancelable) return
      event.preventDefault()
      if (interactionsBlocked()) return
      const bounds = canvas.getBoundingClientRect()
      navigation.wheel(event.deltaY, event.deltaMode,
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top }, bounds.height)
    }
    const keyDown = (event: KeyboardEvent) => {
      if (interactionsBlocked()) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const shortcut = historyShortcut(event, {
        editable: Boolean(target?.closest('input:not([type="range"]),textarea,select') || target?.isContentEditable),
        inkPointerId: drawingPointerId(), panPointerId: navigation.pointerId,
      })
      if (shortcut) {
        event.preventDefault()
        if (!shortcut.blocked) applyHistory(shortcut.action)
        return
      }
      if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return
      if (target?.closest('input:not([type="range"]),textarea,select,[contenteditable]')) return
      if (!target?.closest('button,summary,input[type="range"]')) event.preventDefault()
      spaceDown = true
      updateCursor()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      spaceDown = false
      updateCursor()
    }
    const blur = () => {
      spaceDown = false
      cancel()
    }
    const center = () => {
      const bounds = canvas.getBoundingClientRect()
      return { x: bounds.width / 2, y: bounds.height / 2 }
    }
    controlsRef.current = {
      zoomIn: () => { if (!interactionsBlocked()) navigation.setZoom(navigation.viewport.zoom * 2, center()) },
      zoomOut: () => { if (!interactionsBlocked()) navigation.setZoom(navigation.viewport.zoom / 2, center()) },
      reset: () => { if (!interactionsBlocked()) navigation.reset() },
      undo: () => { applyHistory('undo') },
      redo: () => { applyHistory('redo') },
      snapshot: () => ({ strokes: scene.strokes, viewport: viewportRef.current }),
      isBusy: () => drawingPointerId() !== null || navigation.pointerId !== null,
      cancelInput: cancel,
    }

    let dprQuery: MediaQueryList | undefined
    let watchedDpr = -1
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = validDpr(window.devicePixelRatio)
      const nativeScale = validDpr(visualViewport?.scale ?? 1)
      if (renderer.needsResize(bounds.width, bounds.height, dpr, nativeScale)) {
        cancel()
        renderer.resize(bounds.width, bounds.height, dpr, nativeScale)
      }
      const resolution = renderer.resolution
      diagnostics = {
        ...diagnostics, dpr, nativeScale,
        requestedRatio: resolution.requestedRatio, effectiveRatio: resolution.effectiveRatio,
        bitmapWidth: resolution.width, bitmapHeight: resolution.height, resolutionCapped: resolution.capped,
      }
      scheduleDiagnostics()
      if (watchedDpr !== dpr && typeof window.matchMedia === 'function') {
        dprQuery?.removeEventListener('change', resize)
        watchedDpr = dpr
        dprQuery = window.matchMedia(`(resolution: ${dpr}dppx)`)
        dprQuery.addEventListener('change', resize)
      }
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('lostpointercapture', lostCapture)
    canvas.addEventListener('contextmenu', contextMenu)
    canvas.addEventListener('wheel', wheel, { passive: false })
    // Window listeners also handle releases outside the sheet when capture is unavailable.
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up, { passive: false })
    window.addEventListener('pointercancel', pointerCancel)
    window.addEventListener('blur', blur)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('resize', resize)
    visualViewport?.addEventListener('resize', resize)
    if (observer) {
      try {
        // Physical-size observation also wakes resize when only DPR changes.
        const devicePixels = typeof ResizeObserverEntry !== 'undefined'
          && 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype
        observer.observe(canvas, { box: devicePixels ? 'device-pixel-content-box' : 'content-box' })
      } catch {
        observer.observe(canvas)
      }
    }
    updateBackground()
    publishHistoryState()
    resize()

    return () => {
      disposed = true
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      canvas.removeEventListener('contextmenu', contextMenu)
      canvas.removeEventListener('wheel', wheel)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', pointerCancel)
      window.removeEventListener('blur', blur)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('resize', resize)
      visualViewport?.removeEventListener('resize', resize)
      observer?.disconnect()
      dprQuery?.removeEventListener('change', resize)
      cancel()
      renderer.dispose()
      controlsRef.current = null
      clearTimeout(diagnosticsTimer)
    }
  }, [onDiagnostics, onUnavailable, onHistoryState, controlsRef, initialDocument, canWrite, interactionsBlocked, onDocumentChange, getTool])

  return (
    <section className="writing-surface" aria-label="Лист для проверки пера">
      <div ref={backgroundRef} className="board-background" data-background={background} aria-hidden="true" />
      <canvas ref={completedRef} className="completed-canvas" data-layer="completed" aria-hidden="true" />
      <canvas ref={canvasRef} className="live-canvas" data-tool={tool} data-layer="live" tabIndex={0} aria-label="Область письма и стирания пером или основной кнопкой мыши" aria-describedby="prototype-warning writing-help">
        Для письма нужен браузер с поддержкой Canvas 2D.
      </canvas>
      <p id="writing-help" className="visually-hidden">Пишите кончиком пера или левой кнопкой мыши. Ластик удаляет штрихи целиком. Толщина меняется со следующего штриха пера. Колесо меняет масштаб вокруг курсора. Пробел и перетаскивание или средняя кнопка перемещают доску.</p>
    </section>
  )
}
