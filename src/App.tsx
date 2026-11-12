import { useRef, useState } from 'react'
import { PenToolbar } from './components/PenToolbar'
import { WritingSurface } from './components/WritingSurface'
import { validDpr } from './drawing/coordinates'
import type { InputDiagnostics, SurfaceControls } from './drawing/types'
import { DEFAULT_STABILIZATION_STRENGTH, normalizeStrength } from './drawing/stabilization'

export default function App() {
  const [width, setWidth] = useState(3)
  const [strengthValue, setStabilization] = useState(DEFAULT_STABILIZATION_STRENGTH)
  const stabilization = normalizeStrength(strengthValue)
  const [unavailable, setUnavailable] = useState('')
  const controlsRef = useRef<SurfaceControls | null>(null)
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() => ({
    pointerType: null, pressure: null, active: false,
    dpr: validDpr(window.devicePixelRatio),
    coalesced: typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function',
    zoom: 1, nativeScale: validDpr(window.visualViewport?.scale ?? 1),
    requestedRatio: 1, effectiveRatio: 1, bitmapWidth: 0, bitmapHeight: 0, resolutionCapped: false,
  }))

  return (
    <main className="app">
      <PenToolbar width={width} onWidthChange={setWidth} diagnostics={diagnostics}
        stabilization={stabilization} onStabilizationChange={setStabilization}
        onZoomIn={() => controlsRef.current?.zoomIn()} onZoomOut={() => controlsRef.current?.zoomOut()}
        onResetView={() => controlsRef.current?.reset()} />
      {unavailable ? (
        <div className="capability-error" role="alert">
          <h2>Не удалось открыть лист</h2>
          <p>{unavailable} Откройте страницу в актуальной версии Chrome или Edge.</p>
        </div>
      ) : <WritingSurface width={width} stabilization={stabilization} controlsRef={controlsRef} onDiagnostics={setDiagnostics} onUnavailable={setUnavailable} />}
    </main>
  )
}
