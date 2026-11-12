import type { InputDiagnostics } from '../drawing/types'

export function PointerDiagnostics({ diagnostics }: { diagnostics: InputDiagnostics }) {
  return (
    <details className="diagnostics">
      <summary>Диагностика</summary>
      <div className="diagnostics-panel">
        <dl>
          <div><dt>Указатель</dt><dd>{diagnostics.pointerType ?? 'ожидание ввода'}</dd></div>
          <div><dt>Давление</dt><dd>{diagnostics.pressure?.toFixed(3) ?? '—'}</dd></div>
          <div><dt>Штрих</dt><dd>{diagnostics.active ? 'идёт письмо' : 'не активен'}</dd></div>
          <div><dt>DPR</dt><dd>{diagnostics.dpr}</dd></div>
          <div><dt>Coalesced events</dt><dd>{diagnostics.coalesced ? 'доступны' : 'обычные события'}</dd></div>
          <div><dt>Масштаб доски</dt><dd>{Math.round(diagnostics.zoom * 100)}%</dd></div>
          <div><dt>Масштаб pinch</dt><dd>{diagnostics.nativeScale.toFixed(2)}×</dd></div>
          <div><dt>Разрешение</dt><dd>{diagnostics.effectiveRatio.toFixed(2)}× / {diagnostics.requestedRatio.toFixed(2)}×</dd></div>
          <div><dt>Каждый слой</dt><dd>{diagnostics.bitmapWidth} × {diagnostics.bitmapHeight} px</dd></div>
        </dl>
        <p className={diagnostics.resolutionCapped ? 'resolution-limit' : undefined}>
          {diagnostics.resolutionCapped
            ? 'Достигнут предел разрешения: 16,8 млн пикселей на два слоя, до 8192 px на сторону.'
            : 'Разрешение: фактическое / запрошенное. Два слоя, до 16,8 млн пикселей суммарно.'}
        </p>
        <p>Давление показано из события. Толщина ручки постоянная.</p>
      </div>
    </details>
  )
}
