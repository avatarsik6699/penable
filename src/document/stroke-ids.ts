import type { Stroke } from '../drawing/types'
import { MAX_STROKE_ID } from './codec'

// A batch reserves IDs incrementally; source fragments must never rescan the scene
// for every inserted item. The single-stroke capture path uses the same allocator.
export function createStrokeIdAllocator(strokes: readonly Stroke[]): () => number {
  let maximum = 0
  const used = new Set<number>()
  for (const stroke of strokes) { used.add(stroke.id); maximum = Math.max(maximum, stroke.id) }
  let next = maximum < MAX_STROKE_ID ? maximum + 1 : 1
  return () => {
    const start = next
    while (used.has(next)) {
      next = next < MAX_STROKE_ID ? next + 1 : 1
      if (next === start) throw new Error('Нет свободного допустимого ID штриха.')
    }
    const id = next
    used.add(id)
    next = next < MAX_STROKE_ID ? next + 1 : 1
    return id
  }
}
export function allocateStrokeId(strokes: readonly Stroke[]): number {
  return createStrokeIdAllocator(strokes)()
}
