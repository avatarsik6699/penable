import { useEffect, useRef, type RefObject } from 'react'
import { validDpr } from '../drawing/coordinates'
import { PenInput } from '../drawing/input'
import { CanvasRenderer } from '../drawing/renderer'
import type { HistoryState, InputDiagnostics, Scene, SurfaceControls } from '../drawing/types'
import { BoardNavigation, initialViewport } from '../drawing/viewport'
import { StrokeHistory } from '../drawing/history'
import { historyShortcut, type HistoryAction } from '../drawing/shortcuts'
import { backgroundLayout, type BackgroundMode } from '../drawing/background'

interface WritingSurfaceProps {
  width: number
  stabilization: number
  background: BackgroundMode
  onHistoryState: (state: HistoryState) => void
  onDiagnostics: (value: InputDiagnostics) => void
  onUnavailable: (reason: string) => void
  controlsRef: RefObject<SurfaceControls | null>
}

export function WritingSurface({ width, stabilization, background, onHistoryState, onDiagnostics, onUnavailable, controlsRef }: WritingSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const completedRef = useRef<HTMLCanvasElement>(null)
  const backgroundRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef(width)
  const stabilizationRef = useRef(stabilization)
  const sceneRef = useRef<Scene>({ strokes: [], active: null })
  const historyRef = useRef<StrokeHistory | null>(null)
  const historyStateRef = useRef<HistoryState | null>(null)
  const viewportRef = useRef(initialViewport())

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
    const history = historyRef.current ?? new StrokeHistory(scene.strokes)
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
      onActiveChange: () => renderer.activeChanged(),
      onCommit: (stroke) => {
        history.commit(stroke)
        renderer.commit(stroke)
        publishHistoryState()
      },
    })
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
        active: input.pointerId !== null,
      }
      scheduleDiagnostics()
    }
    const navigation = new BoardNavigation({
      viewport: viewportRef.current,
      isDrawing: () => input.pointerId !== null,
      onChange: (viewport) => {
        viewportRef.current = viewport
        renderer.setViewport(viewport)
        updateBackground()
        diagnostics = { ...diagnostics, zoom: viewport.zoom }
        scheduleDiagnostics()
      },
    })
    let disposed = false
    const publishHistoryState = () => {
      if (disposed) return
      const next = {
        canUndo: history.canUndo, canRedo: history.canRedo,
        busy: input.pointerId !== null || navigation.pointerId !== null,
      }
      const previous = historyStateRef.current
      if (previous && previous.canUndo === next.canUndo && previous.canRedo === next.canRedo && previous.busy === next.busy) return
      historyStateRef.current = next
      onHistoryState(next)
    }
    const applyHistory = (action: HistoryAction) => {
      if (input.pointerId !== null || navigation.pointerId !== null) return
      if (action === 'undo' ? history.undo() : history.redo()) {
        renderer.sceneChanged()
        publishHistoryState()
      }
    }
    let spaceDown = false
    const updateCursor = () => {
      canvas.dataset.panReady = String(spaceDown && input.pointerId === null)
      canvas.dataset.panning = String(navigation.pointerId !== null)
    }
    const releaseCapture = (pointerId: number | null) => {
      if (pointerId === null) return
      try {
        if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId)
      } catch { /* Synthetic events have no native pointer to capture or release. */ }
    }
    const cancel = () => {
      const pointerId = input.pointerId ?? navigation.pointerId
      input.cancel()
      navigation.endPan()
      releaseCapture(pointerId)
      updateCursor()
      observeInput()
      publishHistoryState()
    }
    const down = (event: PointerEvent) => {
      if (navigation.startPan(event, spaceDown)
        || (navigation.pointerId === null && !spaceDown && input.down(event))) {
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
      const pointerId = input.pointerId
      if (input.move(event)) event.preventDefault()
      if (pointerId !== null && input.pointerId === null) {
        releaseCapture(pointerId)
        publishHistoryState()
      }
      updateCursor()
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const up = (event: PointerEvent) => {
      if (navigation.endPan(event.pointerId)) {
        event.preventDefault()
        releaseCapture(event.pointerId)
        updateCursor()
        observeInput(event)
        publishHistoryState()
        return
      }
      const pointerId = input.pointerId
      if (input.up(event)) {
        event.preventDefault()
        releaseCapture(event.pointerId)
      }
      updateCursor()
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== input.pointerId && event.pointerId !== navigation.pointerId) return
      cancel()
      observeInput(event)
    }
    const lostCapture = (event: PointerEvent) => {
      const panEnded = navigation.endPan(event.pointerId)
      const inkEnded = input.cancel(event.pointerId)
      if (panEnded || inkEnded) {
        updateCursor()
        observeInput(event)
        publishHistoryState()
      }
    }
    const contextMenu = (event: MouseEvent) => event.preventDefault()
    const wheel = (event: WheelEvent) => {
      if (!event.cancelable) return
      event.preventDefault()
      const bounds = canvas.getBoundingClientRect()
      navigation.wheel(event.deltaY, event.deltaMode,
        { x: event.clientX - bounds.left, y: event.clientY - bounds.top }, bounds.height)
    }
    const keyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const shortcut = historyShortcut(event, {
        editable: Boolean(target?.closest('input:not([type="range"]),textarea,select') || target?.isContentEditable),
        inkPointerId: input.pointerId, panPointerId: navigation.pointerId,
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
      zoomIn: () => { navigation.setZoom(navigation.viewport.zoom * 2, center()) },
      zoomOut: () => { navigation.setZoom(navigation.viewport.zoom / 2, center()) },
      reset: () => { navigation.reset() },
      undo: () => { applyHistory('undo') },
      redo: () => { applyHistory('redo') },
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
  }, [onDiagnostics, onUnavailable, onHistoryState, controlsRef])

  return (
    <section className="writing-surface" aria-label="Лист для проверки пера">
      <div ref={backgroundRef} className="board-background" data-background={background} aria-hidden="true" />
      <canvas ref={completedRef} className="completed-canvas" data-layer="completed" aria-hidden="true" />
      <canvas ref={canvasRef} className="live-canvas" data-layer="live" tabIndex={0} aria-label="Область письма пером или основной кнопкой мыши" aria-describedby="prototype-warning writing-help">
        Для письма нужен браузер с поддержкой Canvas 2D.
      </canvas>
      <p id="writing-help" className="visually-hidden">Пишите кончиком пера или левой кнопкой мыши. Толщина меняется со следующего штриха. Колесо меняет масштаб вокруг курсора. Пробел и перетаскивание или средняя кнопка перемещают доску.</p>
    </section>
  )
}
