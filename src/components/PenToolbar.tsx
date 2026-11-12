import type { InputDiagnostics } from '../drawing/types'
import { PointerDiagnostics } from './PointerDiagnostics'

interface PenToolbarProps {
  width: number
  onWidthChange: (width: number) => void
  diagnostics: InputDiagnostics
}

export function PenToolbar({ width, onWidthChange, diagnostics }: PenToolbarProps) {
  return (
    <header className="pen-toolbar">
      <div className="toolbar-row">
        <h1>penable<span className="brand-dot" aria-hidden="true" /></h1>
        <div className="width-control">
          <label htmlFor="pen-width">Толщина</label>
          <input id="pen-width" type="range" min="1" max="12" step="1" value={width}
            aria-valuetext={`${width} пикселей`} onChange={(event) => onWidthChange(Number(event.target.value))} />
          <output htmlFor="pen-width">{width} <span>px</span></output>
          <span className="pen-preview" aria-hidden="true"><span style={{ width, height: width }} /></span>
        </div>
        <PointerDiagnostics diagnostics={diagnostics} />
      </div>
      <p id="prototype-warning">Проверка пера. Записи исчезнут при перезагрузке.</p>
    </header>
  )
}
