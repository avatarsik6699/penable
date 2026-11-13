import { useEffect, useRef, type RefObject } from 'react'
import { BoardCursor } from '../drawing/cursor'
import { validDpr } from '../drawing/coordinates'
import { EraserInput } from '../drawing/eraser'
import { PenInput } from '../drawing/input'
import { BoardSelection, prepareSelection } from '../drawing/selection'
import { downloadPNG, selectionPNG, writePNG } from '../drawing/png'
import { CanvasRenderer } from '../drawing/renderer'
import type { DrawingTool, HistoryState, InputDiagnostics, Scene, SelectionState, SelectionCommand, SurfaceControls } from '../drawing/types'
import { BoardNavigation, fitAll, initialViewport } from '../drawing/viewport'
import { StrokeHistory } from '../drawing/history'
import { historyShortcut, selectionNudgeShortcut, type HistoryAction } from '../drawing/shortcuts'
import { backgroundLayout, type BackgroundMode } from '../drawing/background'
import { cloneDocument, decodeDocument } from '../document/codec'
import type { BoardDocument } from '../document/types'
import { DocumentJobs, heavyDocument } from '../document/jobs'
import { allocateStrokeId } from '../document/stroke-ids'

interface WritingSurfaceProps {
  tool: DrawingTool
  onActivateSelection: () => void
  onSelectionState: (state: SelectionState) => void
  getTool: () => DrawingTool
  width: number
  stabilization: number
  background: BackgroundMode
  initialDocument: BoardDocument
  canWrite: () => boolean
  modalOpen: boolean
  uiRevision: number
  interactionsBlocked: () => boolean
  onDocumentChange: (urgent: boolean) => void
  onHistoryState: (state: HistoryState) => void
  onDiagnostics: (value: InputDiagnostics) => void
  onUnavailable: (reason: string) => void
  controlsRef: RefObject<SurfaceControls | null>
}

export function WritingSurface({ onActivateSelection, onSelectionState, tool, getTool, width, stabilization, background, initialDocument, canWrite, interactionsBlocked, modalOpen, uiRevision,
  onDocumentChange, onHistoryState, onDiagnostics, onUnavailable, controlsRef }: WritingSurfaceProps) {
  const selectionPathRef = useRef<SVGPathElement>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const cursorRef = useRef<HTMLDivElement>(null)
  const focusBadgeRef = useRef<HTMLSpanElement>(null)
  const refreshCursorRef = useRef<(() => void) | null>(null)
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

  useEffect(() => { if (modalOpen) cancelRef.current?.(); refreshCursorRef.current?.() }, [tool, modalOpen, uiRevision])

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
        selection.clear()
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
        selection.clear()
        if (history.erase(strokes)) onDocumentChange(true)
      },
    })
    const drawingPointerId = (): number | null => input.pointerId ?? eraser.pointerId ?? selection.pointerId
    const activeInput = () => selection.pointerId !== null ? selection : eraser.pointerId !== null ? eraser : input
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
      isDrawing: () => drawingPointerId() !== null || selection.busy,
      onChange: (viewport) => {
        viewportRef.current = viewport
        renderer.setViewport(viewport)
        updateBackground()
        paintSelection()
        diagnostics = { ...diagnostics, zoom: viewport.zoom }
        scheduleDiagnostics()
        if (canWrite() && !selection.busy) onDocumentChange(false)
      },
    })
    let disposed = false
    let pngBusy = false
    let pngBlob: Blob | null = null
    let pngGeneration = 0
    let previousSelectionState = ''
    const paintSelection = () => {
      const path = selectionPathRef.current
      if (!path) return
      const viewport = viewportRef.current
      path.setAttribute('d', getTool() === 'selection' ? selection.outline.map(polygon => polygon.map(ring => ring.map(([x, y], index) => `${index ? 'L' : 'M'}${x * viewport.zoom + viewport.x},${y * viewport.zoom + viewport.y}`).join(' ') + 'Z').join(' ')).join(' ') : '')
    }
    const publishSelection = () => {
      if (disposed) return
      paintSelection()
      const state = { selected: selection.hasSelection, clipboard: selection.hasClipboard, busy: selection.busy || pngBusy, message: selection.message, png: pngBlob !== null }
      const encoded = JSON.stringify(state)
      if (encoded !== previousSelectionState) { previousSelectionState = encoded; onSelectionState(state) }
      publishHistoryState()
    }
    const selectionJobs = new DocumentJobs()
    const selection = new BoardSelection({
      scene, viewport: () => viewportRef.current, bounds: () => canvas.getBoundingClientRect(), writable: canWrite,
      select: (region, signal) => heavyDocument(scene.strokes, region) ? selectionJobs.select(scene.strokes, region, signal) : prepareSelection(scene.strokes, region),
      validate: (strokes, signal) => {
        const document = { ...initialDocument, schemaVersion: 2 as const, strokes, viewport: { ...viewportRef.current } }
        if (heavyDocument(strokes)) return selectionJobs.validate(strokes, signal, document)
        decodeDocument(document)
      },
      commit: (strokes) => { if (history.replace(strokes)) { renderer.sceneChanged(); onDocumentChange(true) } },
      preview: (strokes) => renderer.setSelectionPreview(strokes), changed: publishSelection,
      setViewport: (viewport) => { navigation.setViewport(viewport) },
    })
    const selectionCommand = (command: SelectionCommand) => {
      if (interactionsBlocked() || input.pointerId !== null || eraser.pointerId !== null || navigation.pointerId !== null) return
      if (command === 'clear') { if (selection.busy) cancel(); else selection.clear(); return }
      if (selection.busy) return
      if (['all', 'paste', 'duplicate'].includes(command)) onActivateSelection()
      if (command === 'all') selection.all()
      if (command === 'copy') selection.copy()
      if (command === 'cut') selection.remove(true)
      if (command === 'delete') selection.remove()
      if (command === 'paste') selection.insert()
      if (command === 'duplicate') selection.insert(true)
      if (command === 'download' && pngBlob) downloadPNG(pngBlob)
      if (command === 'image' && selection.hasSelection && !pngBusy) {
        pngBusy = true; publishSelection()
        const generation = ++pngGeneration
        const promise = selectionPNG(selection.selected, selection.outline)
        // Invoke the clipboard API in the user gesture, passing a deferred PNG Blob.
        const clipboard = writePNG(promise)
        void Promise.allSettled([promise, clipboard]).then(([result, written]) => {
          if (disposed || generation !== pngGeneration) return
          pngBusy = false
          if (result.status === 'fulfilled') pngBlob = result.value
          selection.message = result.status === 'rejected' ? String(result.reason instanceof Error ? result.reason.message : result.reason)
            : written.status === 'fulfilled' ? 'PNG передан в системный буфер.' : 'Не удалось записать PNG в системный буфер. Откройте «Действия» → «Скачать PNG».'
          publishSelection()
        })
      }
    }
    const publishHistoryState = () => {
      if (disposed) return
      const next = {
        canUndo: history.canUndo, canRedo: history.canRedo,
        busy: drawingPointerId() !== null || navigation.pointerId !== null || selection.busy,
      }
      const previous = historyStateRef.current
      if (previous && previous.canUndo === next.canUndo && previous.canRedo === next.canRedo && previous.busy === next.busy) return
      historyStateRef.current = next
      onHistoryState(next)
    }
    const applyHistory = (action: HistoryAction) => {
      if (!canWrite() || interactionsBlocked() || drawingPointerId() !== null || navigation.pointerId !== null || selection.busy) return
      if (action === 'undo' ? history.undo() : history.redo()) {
        selection.clear()
        renderer.sceneChanged()
        publishHistoryState()
        onDocumentChange(true)
      }
    }
    let spaceDown = false
    let focused = true
    let keyboardEntry = false
    let cursorFrame: number | null = null
    let lastCursorEvent: PointerEvent | null = null
    const cursor = new BoardCursor()
    const cursorLayer = cursorRef.current
    const paintCursor = () => {
      cursorFrame = null
      if (disposed || !cursorLayer) return
      const { visible, mode, position } = cursor.presentation
      cursorLayer.hidden = !visible
      cursorLayer.dataset.mode = mode
      if (position) cursorLayer.style.transform = `translate(${position.x}px, ${position.y}px)`
      canvas.dataset.appCursorReady = String(visible)
    }
    const updateCursor = () => {
      const mode = navigation.pointerId !== null ? 'panning'
        : spaceDown && drawingPointerId() === null ? 'pan-ready' : getTool() === 'selection' && (selection.moving || (lastCursorEvent && selection.hit({ x: (lastCursorEvent.clientX - canvas.getBoundingClientRect().left - viewportRef.current.x) / viewportRef.current.zoom, y: (lastCursorEvent.clientY - canvas.getBoundingClientRect().top - viewportRef.current.y) / viewportRef.current.zoom }))) ? 'move' : getTool()
      const event = lastCursorEvent
      const overBoard = !event || document.elementFromPoint(event.clientX, event.clientY) === canvas
      cursor.configure(mode, focused && document.visibilityState !== 'hidden' && !interactionsBlocked() && overBoard)
      if (cursorFrame === null) cursorFrame = requestAnimationFrame(paintCursor)
    }
    const cursorSample = (event: PointerEvent) => {
      const owner = drawingPointerId() ?? navigation.pointerId
      if ((event.pointerType !== 'mouse' && event.pointerType !== 'pen') || (owner !== null && owner !== event.pointerId)) return
      lastCursorEvent = event
      cursor.move(event, canvas.getBoundingClientRect(), document.elementFromPoint(event.clientX, event.clientY) === canvas)
      updateCursor()
    }
    const refreshCursor = () => {
      paintSelection()
      if (lastCursorEvent) cursorSample(lastCursorEvent)
      else updateCursor()
    }
    refreshCursorRef.current = refreshCursor
    const leave = (event: PointerEvent) => {
      cursor.leave(event, event.relatedTarget instanceof Element)
      updateCursor()
    }
    const over = (event: PointerEvent) => {
      if (event.target !== canvas) cursorSample(event)
    }
    const focusCanvas = () => {
      if (focusBadgeRef.current) focusBadgeRef.current.hidden = !keyboardEntry
    }
    const blurCanvas = () => { selection.finishNudge(); if (focusBadgeRef.current) focusBadgeRef.current.hidden = true }
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
      selection.cancel()
      navigation.endPan()
      cursor.cancel()
      releaseCapture(pointerId)
      updateCursor()
      observeInput()
      publishHistoryState()
    }
    cancelRef.current = cancel
    const down = (event: PointerEvent) => {
      if (interactionsBlocked()) return
      keyboardEntry = false
      blurCanvas()
      cursorSample(event)
      selection.finishNudge()
      if (navigation.startPan(event, spaceDown)
        || (navigation.pointerId === null && !spaceDown && (getTool() === 'selection' ? selection.down(event) : canWrite() && (getTool() === 'eraser' ? eraser : input).down(event)))) {
        navigation.suspendWheel()
        cursor.begin(event.pointerId)
        event.preventDefault()
        canvas.focus({ preventScroll: true })
        try { canvas.setPointerCapture?.(event.pointerId) } catch { /* Window listeners are the fallback. */ }
      }
      if (event.button === 1) event.preventDefault()
      startEdge()
      updateCursor()
      observeInput(event)
      publishHistoryState()
    }
    const move = (event: PointerEvent) => {
      cursorSample(event)
      if ((!canWrite() && (input.pointerId !== null || eraser.pointerId !== null || selection.moving)) || interactionsBlocked()) { cancel(); return }
      const panPointer = navigation.pointerId
      if (navigation.movePan(event)) {
        event.preventDefault()
        if (navigation.pointerId === null) {
          cursor.end(panPointer ?? undefined)
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
        cursor.end(pointerId)
        releaseCapture(pointerId)
        publishHistoryState()
      }
      updateCursor()
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const up = (event: PointerEvent) => {
      cursorSample(event)
      cursor.end(event.pointerId)
      if ((!canWrite() && (input.pointerId !== null || eraser.pointerId !== null || selection.moving)) || interactionsBlocked()) { cancel(); return }
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
      const selectionEnded = selection.pointerId === event.pointerId && selection.cancel()
      if (panEnded || inkEnded || eraseEnded || selectionEnded) {
        cursor.end(event.pointerId)
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
      navigation.wheel({ deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode,
        ctrlKey: event.ctrlKey, shiftKey: event.shiftKey,
        anchor: { x: event.clientX - bounds.left, y: event.clientY - bounds.top }, width: bounds.width, height: bounds.height })
    }
    const keyDown = (event: KeyboardEvent) => {
      if (event.code === 'Tab') keyboardEntry = true
      if (interactionsBlocked()) return
      const target = event.target instanceof HTMLElement ? event.target : null
      const editable = Boolean(target?.closest('input,textarea,select,[contenteditable],dialog'))
      const boardContext = Boolean(target === canvas || target?.closest('.selection-toolbar'))
      if (boardContext && !editable && !event.altKey && !event.isComposing && !event.defaultPrevented) {
        const modifier = event.ctrlKey || event.metaKey
        const commands: Record<string, SelectionCommand> = { KeyA: 'all', KeyC: 'copy', KeyX: 'cut', KeyV: 'paste', KeyD: 'duplicate' }
        const command = modifier ? commands[event.code] : event.code === 'Escape' ? 'clear' : ['Delete', 'Backspace'].includes(event.code) ? 'delete' : undefined
        if (command) { event.preventDefault(); if (command === 'clear' && (drawingPointerId() !== null || navigation.pointerId !== null)) cancel(); else selectionCommand(command); updateCursor(); return }
        const nudge = selectionNudgeShortcut(event, { editable, inkPointerId: drawingPointerId(), panPointerId: navigation.pointerId })
        if (nudge && getTool() === 'selection' && selection.hasSelection) {
          event.preventDefault()
          if (!nudge.blocked) selection.nudge(nudge.x, nudge.y)
          return
        }
      }
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
      if (event.code.startsWith('Arrow')) selection.finishNudge()
      if (event.code !== 'Space') return
      spaceDown = false
      updateCursor()
    }
    const blur = () => {
      focused = false
      spaceDown = false
      cancel()
    }
    const focus = () => { focused = true; refreshCursor() }
    const visibility = () => {
      if (document.visibilityState === 'hidden') blur()
      else focus()
    }
    const center = () => {
      const bounds = canvas.getBoundingClientRect()
      return { x: bounds.width / 2, y: bounds.height / 2 }
    }
    controlsRef.current = {
      zoomIn: () => { if (!interactionsBlocked()) navigation.setZoom(navigation.viewport.zoom * 2, center()) },
      zoomOut: () => { if (!interactionsBlocked()) navigation.setZoom(navigation.viewport.zoom / 2, center()) },
      fitAll: () => { if (!interactionsBlocked() && !selection.busy && drawingPointerId() === null && navigation.pointerId === null) { const bounds = canvas.getBoundingClientRect(); navigation.setViewport(fitAll(scene.strokes, bounds.width, bounds.height)) } },
      selection: (command) => { selectionCommand(command); refreshCursor() },
      selectionShape: (shape) => { if (!selection.busy) { selection.shape = shape; publishSelection() } },
      reset: () => { if (!interactionsBlocked()) navigation.reset() },
      undo: () => { applyHistory('undo') },
      redo: () => { applyHistory('redo') },
      snapshot: () => ({ strokes: scene.strokes, viewport: viewportRef.current }),
      isBusy: () => drawingPointerId() !== null || navigation.pointerId !== null || selection.busy,
      cancelInput: cancel,
    }

    let edgeFrame: number | null = null
    let edgeTime = performance.now()
    const edgeTick = (time: number) => {
      edgeFrame = null
      if (disposed) return
      if (selection.moving && lastCursorEvent) {
        const bounds = canvas.getBoundingClientRect()
        selection.edgePan({ x: lastCursorEvent.clientX - bounds.left, y: lastCursorEvent.clientY - bounds.top }, (time - edgeTime) / 1000)
      }
      edgeTime = time
      if (selection.moving) edgeFrame = requestAnimationFrame(edgeTick)
    }
    const startEdge = () => { if (selection.moving && edgeFrame === null) { edgeTime = performance.now(); edgeFrame = requestAnimationFrame(edgeTick) } }
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
    canvas.addEventListener('pointerenter', cursorSample)
    canvas.addEventListener('pointerleave', leave)
    canvas.addEventListener('focus', focusCanvas)
    canvas.addEventListener('blur', blurCanvas)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('lostpointercapture', lostCapture)
    canvas.addEventListener('contextmenu', contextMenu)
    canvas.addEventListener('wheel', wheel, { passive: false })
    // Window listeners also handle releases outside the sheet when capture is unavailable.
    window.addEventListener('pointerover', over)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('toggle', refreshCursor, true)
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
    publishSelection()
    publishHistoryState()
    resize()

    return () => {
      disposed = true
      pngGeneration++
      cancelRef.current = null
      if (edgeFrame !== null) cancelAnimationFrame(edgeFrame)
      refreshCursorRef.current = null
      canvas.removeEventListener('pointerenter', cursorSample)
      canvas.removeEventListener('pointerleave', leave)
      canvas.removeEventListener('focus', focusCanvas)
      canvas.removeEventListener('blur', blurCanvas)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      canvas.removeEventListener('contextmenu', contextMenu)
      canvas.removeEventListener('wheel', wheel)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('focus', focus)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('toggle', refreshCursor, true)
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
      selectionJobs.cancel()
      void selectionJobs.close()
      if (cursorFrame !== null) cancelAnimationFrame(cursorFrame)
      delete canvas.dataset.appCursorReady
      if (cursorLayer) cursorLayer.hidden = true
      renderer.dispose()
      controlsRef.current = null
      clearTimeout(diagnosticsTimer)
    }
  }, [onDiagnostics, onUnavailable, onHistoryState, controlsRef, initialDocument, canWrite, interactionsBlocked, onDocumentChange, getTool, onSelectionState, onActivateSelection])

  return (
    <section className="writing-surface" aria-label="Лист для проверки пера">
      <div ref={backgroundRef} className="board-background" data-background={background} aria-hidden="true" />
      <canvas ref={completedRef} className="completed-canvas" data-layer="completed" aria-hidden="true" />
      <canvas ref={canvasRef} className="live-canvas" data-tool={tool} data-layer="live" tabIndex={0} aria-label="Область письма и стирания пером или основной кнопкой мыши" aria-describedby="prototype-warning writing-help">
        Для письма нужен браузер с поддержкой Canvas 2D.
      </canvas>
      <svg className="selection-outline" aria-hidden="true"><path ref={selectionPathRef} /></svg>
      <div ref={cursorRef} className="board-cursor" hidden aria-hidden="true">
        <svg className="cursor-arrow" viewBox="0 0 24 28"><path d="M2 2v21l6-6 5 9 4-2-5-9h9Z" /></svg>
        <svg className="cursor-move" viewBox="0 0 24 24"><path d="M12 1 8 5h3v6H5V8l-4 4 4 4v-3h6v6H8l4 4 4-4h-3v-6h6v3l4-4-4-4v3h-6V5h3Z" /></svg>
        <span className="cursor-dot" />
        <span className="cursor-eraser" />
        <svg className="cursor-hand cursor-hand-open" viewBox="0 0 24 24"><path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6a1.5 1.5 0 0 1 2.4-1.8L8 14Z" /></svg>
        <svg className="cursor-hand cursor-hand-closed" viewBox="0 0 24 24"><path d="M7 12V9a1.5 1.5 0 0 1 3 0v2-3a1.5 1.5 0 0 1 3 0v3-2a1.5 1.5 0 0 1 3 0v3-1a1.5 1.5 0 0 1 3 0v5c0 4-3 6-6 6h-1c-2 0-4-1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.6L7 14Z" /></svg>
      </div>
      <span ref={focusBadgeRef} className="canvas-focus-badge" hidden>Полотно</span>
      <p id="writing-help" className="visually-hidden">Пишите кончиком пера или левой кнопкой мыши. Ластик удаляет штрихи целиком. Толщина меняется со следующего штриха пера. Колесо перемещает доску. Ctrl и колесо меняют масштаб вокруг курсора. Пробел и перетаскивание или средняя кнопка перемещают доску.</p>
    </section>
  )
}
