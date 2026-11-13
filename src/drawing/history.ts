import type { Stroke } from './types'

type IndexedStroke = { stroke: Stroke; index: number }
type Operation = { removed: IndexedStroke[]; inserted: IndexedStroke[] }

export class StrokeHistory {
  private readonly done: Operation[]
  private readonly undone: Operation[] = []

  constructor(readonly strokes: Stroke[] = [], undoFloor = 0) {
    this.done = strokes.slice(undoFloor).map((stroke, offset) => ({
      removed: [], inserted: [{ stroke, index: undoFloor + offset }],
    }))
  }

  get canUndo(): boolean { return this.done.length > 0 }
  get canRedo(): boolean { return this.undone.length > 0 }

  commit(stroke: Stroke) {
    this.record({ removed: [], inserted: [{ stroke, index: this.strokes.length }] })
  }

  erase(strokes: ReadonlySet<Stroke>): boolean {
    const entries: IndexedStroke[] = []
    this.strokes.forEach((stroke, index) => { if (strokes.has(stroke)) entries.push({ stroke, index }) })
    if (!entries.length) return false
    this.record({ removed: entries, inserted: [] })
    return true
  }

  undo(): boolean {
    const operation = this.done.pop()
    if (!operation) return false
    this.apply({ removed: operation.inserted, inserted: operation.removed })
    this.undone.push(operation)
    return true
  }

  redo(): boolean {
    const operation = this.undone.pop()
    if (!operation) return false
    this.apply(operation)
    this.done.push(operation)
    return true
  }

  private record(operation: Operation) {
    this.apply(operation)
    this.done.push(operation)
    this.undone.length = 0
  }

  replace(candidate: readonly Stroke[]): boolean {
    if (candidate.length === this.strokes.length && candidate.every((stroke, index) => stroke === this.strokes[index])) return false
    // A replacement may reorder reused references. Record all positions so replay is
    // exactly the candidate, including those references and their original identity.
    const removed = this.strokes.map((stroke, index) => ({ stroke, index }))
    const inserted = candidate.map((stroke, index) => ({ stroke, index }))
    this.record({ removed, inserted })
    return true
  }

  private apply(operation: Operation) {
    for (const { stroke } of [...operation.removed].reverse()) {
      const index = this.strokes.indexOf(stroke)
      if (index !== -1) this.strokes.splice(index, 1)
    }
    for (const { stroke, index } of operation.inserted) this.strokes.splice(index, 0, stroke)
  }
}
