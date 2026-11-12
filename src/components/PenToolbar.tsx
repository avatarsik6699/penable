import type { HistoryState, InputDiagnostics } from '../drawing/types'
import { PointerDiagnostics } from './PointerDiagnostics'
import type { BackgroundMode } from '../drawing/background'

interface PenToolbarProps {
  width: number
  onWidthChange: (width: number) => void
  diagnostics: InputDiagnostics
  stabilization: number
  onStabilizationChange: (strength: number) => void
  background: BackgroundMode
  onBackgroundChange: (mode: BackgroundMode) => void
  historyState: HistoryState
  onUndo: () => void
  onRedo: () => void
  onZoomIn: () => void
  onZoomOut: () => void
  onResetView: () => void
}

export function PenToolbar({ width, onWidthChange, diagnostics, stabilization, onStabilizationChange, background,
  onBackgroundChange, historyState, onUndo, onRedo, onZoomIn, onZoomOut, onResetView }: PenToolbarProps) {
  return (
    <header className="pen-toolbar">
      <div className="toolbar-row">
        <h1>penable<span className="brand-dot" aria-hidden="true" /></h1>
        <div className="history-controls" role="group" aria-label="История штрихов">
          <button type="button" onClick={onUndo} aria-label="Отменить штрих" title="Отменить штрих (Ctrl+Z / ⌘Z)"
            disabled={historyState.busy || !historyState.canUndo}>↶</button>
          <button type="button" onClick={onRedo} aria-label="Вернуть штрих" title="Вернуть штрих (Ctrl+Shift+Z / ⌘Shift+Z)"
            disabled={historyState.busy || !historyState.canRedo}>↷</button>
        </div>
        <div className="width-control">
          <label htmlFor="pen-width">Толщина</label>
          <input id="pen-width" type="range" min="0.5" max="12" step="0.1" value={width}
            aria-valuetext={`${width.toFixed(1)} пикселя`} onChange={(event) => onWidthChange(Number(event.target.value))} />
          <output htmlFor="pen-width">{width.toFixed(1)} <span>px</span></output>
          <span className="pen-preview" aria-hidden="true"><span style={{ width, height: width }} /></span>
        </div>
        <div className="stabilization-control">
          <div>
            <label htmlFor="pen-stabilization">Стабилизация</label>
            <span id="stabilization-help" className="setting-help">Со следующего штриха</span>
          </div>
          <input id="pen-stabilization" type="range" min="0" max="100" step="1" value={stabilization}
            aria-describedby="stabilization-help" aria-valuetext={`${stabilization.toFixed(0)} процентов`}
            onChange={(event) => onStabilizationChange(Number(event.target.value))} />
          <output htmlFor="pen-stabilization">{stabilization.toFixed(0)} <span>%</span></output>
        </div>
        <div className="zoom-controls" role="group" aria-label="Масштаб доски">
          <button type="button" onClick={onZoomOut} aria-label="Уменьшить масштаб доски"
            title="Уменьшить вокруг центра листа" disabled={diagnostics.active || diagnostics.zoom <= 0.25}>−</button>
          <button type="button" className="zoom-reset" onClick={onResetView}
            aria-label={`Масштаб ${Math.round(diagnostics.zoom * 100)} процентов. Вернуть исходный вид`}
            title="Вернуть 100% и исходное положение" disabled={diagnostics.active}>{Math.round(diagnostics.zoom * 100)}%</button>
          <button type="button" onClick={onZoomIn} aria-label="Увеличить масштаб доски"
            title="Увеличить вокруг центра листа" disabled={diagnostics.active || diagnostics.zoom >= 8}>+</button>
        </div>
        <div className="background-control">
          <label htmlFor="board-background">Фон</label>
          <select id="board-background" value={background}
            onChange={(event) => onBackgroundChange(event.target.value as BackgroundMode)}>
            <option value="blank">Без фона</option>
            <option value="dots">Точки</option>
            <option value="grid">Клетка</option>
          </select>
        </div>
        <PointerDiagnostics diagnostics={diagnostics} />
      </div>
      <div className="toolbar-notes">
        <p id="prototype-warning">Проверка пера. Записи исчезнут при перезагрузке.</p>
        <p className="gesture-help">Колесо — масштаб. Пробел + перетаскивание или средняя кнопка — перемещение.</p>
      </div>
    </header>
  )
}
