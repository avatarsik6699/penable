import type { Stroke } from './types'

export class StrokeHistory {
  private readonly undone: Stroke[] = []

  constructor(readonly strokes: Stroke[] = []) {}

  get canUndo(): boolean { return this.strokes.length > 0 }
  get canRedo(): boolean { return this.undone.length > 0 }

  commit(stroke: Stroke) {
    this.strokes.push(stroke)
    this.undone.length = 0
  }

  undo(): boolean {
    const stroke = this.strokes.pop()
    if (!stroke) return false
    this.undone.push(stroke)
    return true
  }

  redo(): boolean {
    const stroke = this.undone.pop()
    if (!stroke) return false
    this.strokes.push(stroke)
    return true
  }
}
