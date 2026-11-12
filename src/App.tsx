import { useState } from 'react'
import { PenToolbar } from './components/PenToolbar'
import { WritingSurface } from './components/WritingSurface'
import { validDpr } from './drawing/coordinates'
import type { InputDiagnostics } from './drawing/types'

export default function App() {
  const [width, setWidth] = useState(3)
  const [unavailable, setUnavailable] = useState('')
  const [diagnostics, setDiagnostics] = useState<InputDiagnostics>(() => ({
    pointerType: null, pressure: null, active: false,
    dpr: validDpr(window.devicePixelRatio),
    coalesced: typeof PointerEvent !== 'undefined' && typeof PointerEvent.prototype.getCoalescedEvents === 'function',
  }))

  return (
    <main className="app">
      <PenToolbar width={width} onWidthChange={setWidth} diagnostics={diagnostics} />
      {unavailable ? (
        <div className="capability-error" role="alert">
          <h2>Не удалось открыть лист</h2>
          <p>{unavailable} Откройте страницу в актуальной версии Chrome или Edge.</p>
        </div>
      ) : <WritingSurface width={width} onDiagnostics={setDiagnostics} onUnavailable={setUnavailable} />}
    </main>
  )
}
