export type HistoryAction = 'undo' | 'redo'

interface HistoryKeyEvent {
  code: string
  ctrlKey: boolean
  metaKey: boolean
  shiftKey: boolean
  altKey: boolean
  isComposing: boolean
  defaultPrevented: boolean
}

interface HistoryContext {
  editable: boolean
  inkPointerId: number | null
  panPointerId: number | null
}

export function historyShortcut(event: HistoryKeyEvent, context: HistoryContext): { action: HistoryAction; blocked: boolean } | null {
  if (event.code !== 'KeyZ' || (!event.ctrlKey && !event.metaKey) || event.altKey
    || event.isComposing || event.defaultPrevented || context.editable) return null
  return {
    action: event.shiftKey ? 'redo' : 'undo',
    blocked: context.inkPointerId !== null || context.panPointerId !== null,
  }
}
