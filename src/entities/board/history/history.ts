import { type Stroke } from "../board.types";
import { type Operation, type IndexedStroke } from "./history.types";

export class StrokeHistory {
  private readonly done: Operation[];
  private readonly undone: Operation[] = [];

  constructor(
    readonly strokes: Stroke[] = [],
    undoFloor = 0,
  ) {
    this.done = strokes.slice(undoFloor).map((stroke, offset) => ({
      removed: [],
      inserted: [{ stroke, index: undoFloor + offset }],
    }));
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  commit(stroke: Stroke) {
    this.record({
      removed: [],
      inserted: [{ stroke, index: this.strokes.length }],
    });
  }

  erase(strokes: ReadonlySet<Stroke>): boolean {
    const entries: IndexedStroke[] = [];

    this.strokes.forEach((stroke, index) => {
      if (strokes.has(stroke)) entries.push({ stroke, index });
    });

    if (!entries.length) return false;

    this.record({ removed: entries, inserted: [] });

    return true;
  }

  undo(): boolean {
    const operation = this.done.pop();

    if (!operation) return false;

    this.apply(operation, true);
    this.undone.push(operation);

    return true;
  }

  redo(): boolean {
    const operation = this.undone.pop();

    if (!operation) return false;

    this.apply(operation);
    this.done.push(operation);

    return true;
  }

  private record(operation: Operation) {
    this.apply(operation);
    this.done.push(operation);
    this.undone.length = 0;
  }

  replace(candidate: readonly Stroke[]): boolean {
    const current = this.strokes;
    let start = 0;

    while (
      start < current.length &&
      start < candidate.length &&
      current[start] === candidate[start]
    )
      start++;

    if (start === current.length && start === candidate.length) return false;

    let end = current.length,
      candidateEnd = candidate.length;

    while (
      end > start &&
      candidateEnd > start &&
      current[end - 1] === candidate[candidateEnd - 1]
    ) {
      end--;
      candidateEnd--;
    }

    if (current.length === candidate.length) {
      let changed = 0;

      for (let index = start; index < end; index++)
        if (current[index] !== candidate[index]) changed++;

      if (changed < (end - start) / 2) {
        const indices: number[] = [],
          before: Stroke[] = [],
          after: Stroke[] = [];

        for (let index = start; index < end; index++) {
          if (current[index] === candidate[index]) continue;

          indices.push(index);
          before.push(current[index]!);
          after.push(candidate[index]!);
        }

        this.record({ kind: "replace", start, indices, before, after });

        return true;
      }
    }

    this.record({
      kind: "replace",
      start,
      before: current.slice(start, end),
      after: candidate.slice(start, candidateEnd),
    });

    return true;
  }

  private apply(operation: Operation, reverse = false) {
    if (operation.kind === "replace") {
      const before = reverse ? operation.after : operation.before;
      const after = reverse ? operation.before : operation.after;

      if (operation.indices) {
        for (let index = 0; index < operation.indices.length; index++)
          this.strokes[operation.indices[index]!] = after[index]!;

        return;
      }

      const { start } = operation;
      const offset = after.length - before.length;
      const oldLength = this.strokes.length;

      if (offset > 0) {
        this.strokes.length = oldLength + offset;

        for (let index = oldLength - 1; index >= start + before.length; index--)
          this.strokes[index + offset] = this.strokes[index]!;
      } else if (offset < 0) {
        for (let index = start + before.length; index < oldLength; index++)
          this.strokes[index + offset] = this.strokes[index]!;

        this.strokes.length = oldLength + offset;
      }

      for (let index = 0; index < after.length; index++)
        this.strokes[start + index] = after[index]!;

      return;
    }

    const removedEntries = reverse ? operation.inserted : operation.removed;
    const insertedEntries = reverse ? operation.removed : operation.inserted;

    if (
      !removedEntries.length &&
      insertedEntries.length === 1 &&
      insertedEntries[0]!.index === this.strokes.length
    ) {
      this.strokes.push(insertedEntries[0]!.stroke);

      return;
    }

    const removed = new Set(removedEntries.map((entry) => entry.stroke));
    const remaining = this.strokes.filter((stroke) => !removed.has(stroke));
    const length = remaining.length + insertedEntries.length;

    let read = 0,
      inserted = 0;

    this.strokes.length = length;

    for (let index = 0; index < length; index++) {
      const entry = insertedEntries[inserted];

      if (entry && entry.index <= index) {
        this.strokes[index] = entry.stroke;
        inserted++;
      } else this.strokes[index] = remaining[read++]!;
    }
  }
}
