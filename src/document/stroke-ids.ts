import type { Stroke } from '../drawing/types'
import { MAX_STROKE_ID } from './codec'

export function allocateStrokeId(strokes: readonly Stroke[]): number {
  let maximum = 0
  const used = new Set<number>()
  for (const stroke of strokes) {
    used.add(stroke.id)
    maximum = Math.max(maximum, stroke.id)
  }
  if (maximum < MAX_STROKE_ID) return maximum + 1
  let available = 1
  while (used.has(available)) available++
  if (available > MAX_STROKE_ID) throw new Error('Нет свободного допустимого ID штриха.')
  return available
}
