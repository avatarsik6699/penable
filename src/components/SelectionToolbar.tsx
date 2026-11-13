import { useEffect, useRef, useState } from 'react'
import type { SelectionCommand, SelectionShape, SelectionState } from '../drawing/types'
interface Props {
  state: SelectionState
  shape: SelectionShape
  readOnly: boolean
  blocked: boolean
  onShape: (shape: SelectionShape) => void
  onCommand: (command: SelectionCommand) => void
  onCancelActiveInput: () => void
  onOverlayChange: () => void
}
export function SelectionToolbar({ state, shape, readOnly, blocked, onShape, onCommand, onOverlayChange, onCancelActiveInput }: Props) {
  const [open, setOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  const busy = state.busy || blocked
  useEffect(() => {
    if (!open && !blocked && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus({ preventScroll: true })
    }
  }, [open, blocked])
  useEffect(() => { onOverlayChange() }, [open, onOverlayChange])
  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !toolbarRef.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('dialog[open]')) return
      event.preventDefault()
      event.stopPropagation()
      // Consult the current controller, not the last React render: an arrow key
      // can own a preview before its busy state has reached this component.
      onCancelActiveInput()
      restoreFocus.current = true
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open, onCancelActiveInput])
  const command = (value: SelectionCommand) => {
    onCommand(value)
    setOpen(false)
    triggerRef.current?.focus({ preventScroll: true })
  }
  const changeShape = (value: SelectionShape) => { onShape(value); setOpen(false) }
  return <div ref={toolbarRef} className="selection-toolbar" role="region" aria-label="Действия выделения">
    <div className="selection-actions" role="group" aria-label="Способ выделения">
      <button type="button" aria-pressed={shape === 'rectangle'} disabled={busy} onClick={() => changeShape('rectangle')}>Рамка</button>
      <button type="button" aria-pressed={shape === 'lasso'} disabled={busy} onClick={() => changeShape('lasso')}>Лассо</button>
      <button ref={triggerRef} type="button" aria-expanded={open} aria-controls="selection-menu"
        disabled={blocked} onClick={() => setOpen(value => !value)}>Действия</button>
    </div>
    {open && <div id="selection-menu" className="selection-menu">
      <div className="selection-actions" role="group" aria-label="Редактирование фрагмента">
        <button type="button" disabled={busy} onClick={() => command('all')}>Выделить всё</button>
        <button type="button" disabled={busy || !state.selected} onClick={() => command('copy')}>Копировать</button>
        <button type="button" disabled={busy || readOnly || !state.selected} onClick={() => command('cut')}>Вырезать</button>
        <button type="button" disabled={busy || readOnly || !state.clipboard} onClick={() => command('paste')}>Вставить</button>
        <button type="button" disabled={busy || readOnly || !state.selected} onClick={() => command('duplicate')}>Дублировать</button>
        <button type="button" disabled={busy || readOnly || !state.selected} onClick={() => command('delete')}>Удалить</button>
        <button type="button" disabled={busy || !state.selected} onClick={() => command('image')}>Копировать изображение</button>
        {state.png && <button type="button" disabled={busy} onClick={() => command('download')}>Скачать PNG</button>}
        <button type="button" disabled={blocked || (!state.selected && !state.busy)} onClick={() => command('clear')}>Снять выделение</button>
      </div>
      <p className="selection-help" role="status">{state.message || 'Обведите записи. Перетащите выделение или двигайте стрелками. Esc — отмена.'}</p>
    </div>}
    {!open && state.message && <p className="selection-feedback" role="status">{state.message}</p>}
  </div>
}
