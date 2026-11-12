import { describe, expect, it } from 'vitest'
import { historyShortcut } from './shortcuts'

type KeyEvent = Parameters<typeof historyShortcut>[0]
const idle = { editable: false, inkPointerId: null, panPointerId: null }

function keyEvent(overrides: Partial<KeyEvent> = {}): KeyEvent {
  return { code: 'KeyZ', ctrlKey: true, metaKey: false, shiftKey: false,
    altKey: false, isComposing: false, defaultPrevented: false, ...overrides }
}

describe('history keyboard intent', () => {
  it.each([
    [true, false, false, 'undo'], [true, false, true, 'redo'],
    [false, true, false, 'undo'], [false, true, true, 'redo'],
  ] as const)('recognizes ctrl %s / meta %s / shift %s as %s', (ctrlKey, metaKey, shiftKey, action) => {
    expect(historyShortcut(keyEvent({ ctrlKey, metaKey, shiftKey }), idle)).toEqual({ action, blocked: false })
  })

  it('uses physical KeyZ independently of the character produced by the layout', () => {
    const event = { ...keyEvent(), key: 'я' }
    expect(historyShortcut(event, idle)?.action).toBe('undo')
    expect(historyShortcut(keyEvent({ code: 'KeyY' }), idle)).toBeNull()
  })

  it.each([{ ctrlKey: false }, { altKey: true }, { isComposing: true }, { defaultPrevented: true }])(
    'ignores unrecognized or protected keyboard event %j', (overrides) => {
      expect(historyShortcut(keyEvent(overrides), idle)).toBeNull()
    },
  )

  it('leaves native undo and redo in editable controls untouched', () => {
    expect(historyShortcut(keyEvent(), { ...idle, editable: true })).toBeNull()
    expect(historyShortcut(keyEvent({ shiftKey: true }), { ...idle, editable: true })).toBeNull()
  })

  it.each([
    { inkPointerId: 0, panPointerId: null }, { inkPointerId: null, panPointerId: 2 },
    { inkPointerId: 1, panPointerId: 2 },
  ])('recognizes but blocks history during the actual active contact %j', (pointers) => {
    expect(historyShortcut(keyEvent(), { ...idle, ...pointers })).toEqual({ action: 'undo', blocked: true })
    expect(historyShortcut(keyEvent({ shiftKey: true }), { ...idle, ...pointers })).toEqual({ action: 'redo', blocked: true })
  })
})
