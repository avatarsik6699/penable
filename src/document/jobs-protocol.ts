import type { BoardDocument } from './types'
import type { ClipMask, Point, Position, SelectionShape, Stroke } from '../drawing/types'

export type DocumentJobKind = 'select' | 'validate' | 'save'
export interface RegionInput { shape: SelectionShape | 'all'; points: Position[] }
export type StrokeMetadata = Omit<Stroke, 'points'> & { geometry: number }
export type FragmentMetadata = Omit<Stroke, 'points'>
export interface SelectionResult { region: ClipMask; parts: Array<{ index: number; same: boolean; selected: FragmentMetadata; remainder: FragmentMetadata | null }> }
export type JobRequest =
  | { type: 'start'; id: number; kind: DocumentJobKind; root: Omit<BoardDocument, 'strokes'>; region?: RegionInput }
  | { type: 'points'; id: number; geometry: number; length: number; offset: number; values: Float64Array }
  | { type: 'strokes'; id: number; values: StrokeMetadata[] }
  | { type: 'finish'; id: number }
  | { type: 'close'; id: number }
export interface JobResponse { id: number; error?: string; selection?: SelectionResult; chunk?: SelectionResult['parts'] }
export function pointsFromChunk(values: Float64Array): Point[] {
  const points: Point[] = []
  for (let i = 0; i < values.length; i += 4) points.push({ x: values[i]!, y: values[i + 1]!, pressure: values[i + 2]!, time: values[i + 3]! })
  return points
}
