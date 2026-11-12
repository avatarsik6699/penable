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
        </dl>
        <p>Давление показано из события. Толщина ручки постоянная.</p>
      </div>
    </details>
  )
}
