import { useEffect, useRef } from 'react'
import { validDpr } from '../drawing/coordinates'
import { PenInput } from '../drawing/input'
import { CanvasRenderer } from '../drawing/renderer'
import type { InputDiagnostics, Scene } from '../drawing/types'

interface WritingSurfaceProps {
  width: number
  onDiagnostics: (value: InputDiagnostics) => void
  onUnavailable: (reason: string) => void
}

export function WritingSurface({ width, onDiagnostics, onUnavailable }: WritingSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const widthRef = useRef(width)
  const sceneRef = useRef<Scene>({ strokes: [], active: null })

  useEffect(() => { widthRef.current = width }, [width])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let context: CanvasRenderingContext2D | null = null
    try { context = canvas.getContext('2d') } catch { /* Report the same capability fallback below. */ }
    if (!context || typeof PointerEvent === 'undefined') {
      onUnavailable(!context ? 'В этом браузере недоступен Canvas 2D.' : 'В этом браузере недоступны Pointer Events.')
      return
    }

    const scene = sceneRef.current
    const renderer = new CanvasRenderer(canvas, context)
    const input = new PenInput({
      scene,
      bounds: () => canvas.getBoundingClientRect(),
      width: () => widthRef.current,
      draw: (stroke, points, previous) => renderer.draw(stroke, points, previous),
      redraw: () => renderer.redraw(scene),
    })
    let diagnostics: InputDiagnostics = {
      pointerType: null, pressure: null, active: false,
      dpr: validDpr(window.devicePixelRatio),
      coalesced: typeof PointerEvent.prototype.getCoalescedEvents === 'function',
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
    const releaseCapture = (pointerId: number | null) => {
      if (pointerId === null) return
      try {
        if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId)
      } catch { /* Synthetic events have no native pointer to capture or release. */ }
    }
    const cancel = () => {
      const pointerId = input.pointerId
      input.cancel()
      releaseCapture(pointerId)
      observeInput()
    }
    const down = (event: PointerEvent) => {
      if (input.down(event)) {
        event.preventDefault()
        try { canvas.setPointerCapture?.(event.pointerId) } catch { /* Window listeners are the fallback. */ }
      }
      observeInput(event)
    }
    const move = (event: PointerEvent) => {
      const pointerId = input.pointerId
      if (input.move(event)) event.preventDefault()
      if (pointerId !== null && input.pointerId === null) releaseCapture(pointerId)
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const up = (event: PointerEvent) => {
      const pointerId = input.pointerId
      if (input.up(event)) {
        event.preventDefault()
        releaseCapture(event.pointerId)
      }
      if (event.target === canvas || event.pointerId === pointerId) observeInput(event)
    }
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerId !== input.pointerId) return
      cancel()
      observeInput(event)
    }
    const lostCapture = (event: PointerEvent) => {
      if (input.cancel(event.pointerId)) observeInput(event)
    }
    const contextMenu = (event: MouseEvent) => event.preventDefault()

    let dprQuery: MediaQueryList | undefined
    let watchedDpr = -1
    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = validDpr(window.devicePixelRatio)
      if (renderer.needsResize(bounds.width, bounds.height, dpr)) {
        cancel()
        renderer.resize(bounds.width, bounds.height, dpr, scene)
      }
      diagnostics = { ...diagnostics, dpr }
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
    // Window listeners also handle releases outside the sheet when capture is unavailable.
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', up, { passive: false })
    window.addEventListener('pointercancel', pointerCancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', resize)
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
    resize()

    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('lostpointercapture', lostCapture)
      canvas.removeEventListener('contextmenu', contextMenu)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', pointerCancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', resize)
      observer?.disconnect()
      dprQuery?.removeEventListener('change', resize)
      cancel()
      clearTimeout(diagnosticsTimer)
    }
  }, [onDiagnostics, onUnavailable])

  return (
    <section className="writing-surface" aria-label="Лист для проверки пера">
      <canvas ref={canvasRef} aria-label="Область письма пером или основной кнопкой мыши" aria-describedby="prototype-warning writing-help">
        Для письма нужен браузер с поддержкой Canvas 2D.
      </canvas>
      <p id="writing-help" className="visually-hidden">Пишите кончиком пера или левой кнопкой мыши. Толщина меняется со следующего штриха.</p>
    </section>
  )
}
