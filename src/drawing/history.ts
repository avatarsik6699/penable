import type { Stroke } from './types'

type IndexedStroke = { stroke: Stroke; index: number }
type Operation = { kind: 'add' | 'erase'; entries: IndexedStroke[] }

export class StrokeHistory {
  private readonly done: Operation[]
  private readonly undone: Operation[] = []

  constructor(readonly strokes: Stroke[] = [], undoFloor = 0) {
    this.done = strokes.slice(undoFloor).map((stroke, offset) => ({
      kind: 'add', entries: [{ stroke, index: undoFloor + offset }],
    }))
  }

  get canUndo(): boolean { return this.done.length > 0 }
  get canRedo(): boolean { return this.undone.length > 0 }

  commit(stroke: Stroke) {
    this.record({ kind: 'add', entries: [{ stroke, index: this.strokes.length }] })
  }

  erase(strokes: ReadonlySet<Stroke>): boolean {
    const entries: IndexedStroke[] = []
    this.strokes.forEach((stroke, index) => { if (strokes.has(stroke)) entries.push({ stroke, index }) })
    if (!entries.length) return false
    this.record({ kind: 'erase', entries })
    return true
  }

  undo(): boolean {
    const operation = this.done.pop()
    if (!operation) return false
    this.apply(operation, operation.kind === 'erase')
    this.undone.push(operation)
    return true
  }

  redo(): boolean {
    const operation = this.undone.pop()
    if (!operation) return false
    this.apply(operation, operation.kind === 'add')
    this.done.push(operation)
    return true
  }

  private record(operation: Operation) {
    this.apply(operation, operation.kind === 'add')
    this.done.push(operation)
    this.undone.length = 0
  }

  private apply(operation: Operation, insert: boolean) {
    if (insert) {
      for (const { stroke, index } of operation.entries) this.strokes.splice(index, 0, stroke)
    } else {
      for (const { stroke } of [...operation.entries].reverse()) {
        const index = this.strokes.indexOf(stroke)
        if (index !== -1) this.strokes.splice(index, 1)
      }
    }
  }
}
