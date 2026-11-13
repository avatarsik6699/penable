import type { Stroke } from './types'

type IndexedStroke = { stroke: Stroke; index: number }
type DeltaOperation = { kind?: never; removed: IndexedStroke[]; inserted: IndexedStroke[] }
type Replacement = { kind: 'replace'; before: Stroke[]; after: Stroke[] }
type Operation = DeltaOperation | Replacement

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
    this.apply(operation.kind === 'replace' ? { kind: 'replace', before: operation.after, after: operation.before } : { removed: operation.inserted, inserted: operation.removed })
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
    // Snapshots hold references, not copied geometry. Linear replacement preserves the
    // scene array identity and exact ordering without repeated indexOf/splice scans.
    this.record({ kind: 'replace', before: [...this.strokes], after: [...candidate] })
    return true
  }

  private apply(operation: Operation) {
    if (operation.kind === 'replace') {
      this.strokes.length = operation.after.length
      for (let index = 0; index < operation.after.length; index++) this.strokes[index] = operation.after[index]!
      return
    }
    if (!operation.removed.length && operation.inserted.length === 1 && operation.inserted[0]!.index === this.strokes.length) {
      this.strokes.push(operation.inserted[0]!.stroke)
      return
    }
    const removed = new Set(operation.removed.map(entry => entry.stroke))
    const remaining = this.strokes.filter(stroke => !removed.has(stroke))
    const length = remaining.length + operation.inserted.length
    let read = 0, inserted = 0
    this.strokes.length = length
    for (let index = 0; index < length; index++) {
      const entry = operation.inserted[inserted]
      if (entry && entry.index <= index) { this.strokes[index] = entry.stroke; inserted++ }
      else this.strokes[index] = remaining[read++]!
    }
  }
}
