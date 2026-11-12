import { describe, expect, it } from 'vitest'
import { BoardCursor } from './cursor'

const bounds = { left: 120, top: 80, width: 800, height: 600 }
const pen = { pointerId: 4, pointerType: 'pen', clientX: 160, clientY: 130 }

describe('board cursor presentation', () => {
  it('uses local CSS coordinates independent of document zoom and bitmap density', () => {
    const cursor = new BoardCursor()
    expect(cursor.presentation.visible).toBe(false)
    cursor.move(pen, bounds, true)
    expect(cursor.presentation).toEqual({ visible: true, mode: 'pen', position: { x: 40, y: 50 } })
    cursor.configure('eraser', true)
    expect(cursor.presentation.position).toEqual({ x: 40, y: 50 })
    expect(cursor.presentation.mode).toBe('eraser')
  })

  it('keeps contact down/up visible and retains the pen position on proximity leave', () => {
    const cursor = new BoardCursor()
    cursor.move(pen, bounds, true)
    cursor.begin(4)
    cursor.end(4)
    cursor.leave({ ...pen, clientX: 0, clientY: 0 })
    expect(cursor.presentation).toEqual({ visible: true, mode: 'pen', position: { x: 40, y: 50 } })
    cursor.move({ ...pen, clientX: 180 }, bounds, true)
    expect(cursor.presentation.position).toEqual({ x: 60, y: 50 })
  })

  it('keeps active pointer ownership against mouse, pen and touch interleaving', () => {
    const cursor = new BoardCursor()
    cursor.move(pen, bounds, true)
    cursor.begin(4)
    for (const pointerType of ['mouse', 'pen', 'touch']) {
      cursor.move({ ...pen, pointerId: 9, pointerType, clientX: 600 }, bounds, true)
      cursor.leave({ ...pen, pointerId: 9, pointerType }, true)
      cursor.end(9)
    }
    expect(cursor.presentation.position).toEqual({ x: 40, y: 50 })
    expect(cursor.presentation.visible).toBe(true)
    cursor.move({ ...pen, clientX: 200 }, bounds, true)
    expect(cursor.presentation.position?.x).toBe(80)
    cursor.end(4)
    cursor.move({ ...pen, pointerId: 9, pointerType: 'mouse', clientX: 600 }, bounds, true)
    expect(cursor.presentation.position?.x).toBe(480)
  })

  it('ignores touch and invalid coordinates without fabricating a position', () => {
    const cursor = new BoardCursor()
    cursor.move({ ...pen, pointerType: 'touch' }, bounds, true)
    cursor.move({ ...pen, clientX: NaN }, bounds, true)
    expect(cursor.presentation.position).toBeNull()
    expect(cursor.presentation.visible).toBe(false)
  })

  it('hides on mouse leave, UI and out-of-bounds samples; returns on the next valid sample', () => {
    const cursor = new BoardCursor()
    cursor.move(pen, bounds, true)
    cursor.leave(pen, true)
    expect(cursor.presentation.visible).toBe(false)
    cursor.move(pen, bounds, true)
    cursor.leave({ ...pen, pointerType: 'mouse' })
    expect(cursor.presentation.visible).toBe(false)
    cursor.move({ ...pen, clientX: 0 }, bounds, true)
    expect(cursor.presentation.position).toEqual({ x: 40, y: 50 })
    cursor.move(pen, bounds, false)
    expect(cursor.presentation.visible).toBe(false)
    cursor.move(pen, bounds, true)
    expect(cursor.presentation.visible).toBe(true)
  })

  it('updates availability and mode without a pointer sample, and cancels ownership', () => {
    const cursor = new BoardCursor()
    cursor.move(pen, bounds, true)
    cursor.begin(4)
    cursor.configure('panning', false)
    expect(cursor.presentation.visible).toBe(false)
    cursor.configure('pan-ready', true)
    expect(cursor.presentation.visible).toBe(true)
    expect(cursor.presentation.mode).toBe('pan-ready')
    cursor.cancel()
    expect(cursor.presentation.visible).toBe(false)
    cursor.move({ ...pen, pointerId: 5 }, bounds, true)
    expect(cursor.presentation.visible).toBe(true)
  })
})
