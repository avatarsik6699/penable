import { decodeDocument } from './codec'
import { openRepository } from './indexeddb'
import { createStrokeIdAllocator } from './stroke-ids'
import { lasso, rectangle, selectParts, visibleBounds, vertexCount } from '../drawing/regions'
import { pointsFromChunk, type JobRequest, type JobResponse, type StrokeMetadata, type SelectionResult } from './jobs-protocol'
import type { DocumentRepository } from './types'
import type { Point } from '../drawing/types'

const host = globalThis as unknown as { onmessage: ((event: MessageEvent<JobRequest>) => void) | null; postMessage: (message: JobResponse) => void }
const geometries = new Map<number, Point[]>()
let pending: Extract<JobRequest, { type: 'start' }> | null = null
let strokes: StrokeMetadata[] = []
let repository: Promise<DocumentRepository> | null = null
let invalidated = ''
function metadata<T extends { points: Point[] }>(stroke: T): Omit<T, 'points'> { const { points: _points, ...result } = stroke; return result }
async function finish(id: number) {
  const job = pending
  if (!job || job.id !== id) return
  try {
    const document = decodeDocument({ ...job.root, strokes: strokes.map(({ geometry, ...stroke }) => ({ ...stroke, points: geometries.get(geometry) })) })
    let selection: SelectionResult | undefined
    if (job.kind === 'select') {
      if (!job.region) throw new Error('Не задана область выделения.')
      const points = job.region.points
      const bounds = job.region.shape === 'all' ? visibleBounds(document.strokes) : null
      const region = job.region.shape === 'all' ? bounds ? rectangle({ x: bounds.left, y: bounds.top }, { x: bounds.right, y: bounds.bottom }) : []
        : job.region.shape === 'rectangle' ? rectangle(points[0]!, points.at(-1)!) : lasso(points)
      const indices = new Map(document.strokes.map((stroke, index) => [stroke, index]))
      const parts = job.region.shape === 'all' ? document.strokes.map(original => ({ original, selected: original, remainder: null })) : selectParts(document.strokes, region, createStrokeIdAllocator(document.strokes))
      selection = { region, parts: parts.map(part => ({ index: indices.get(part.original)!, same: part.selected === part.original, selected: metadata(part.selected), remainder: part.remainder ? metadata(part.remainder) : null })) }
    }
    if (job.kind === 'save') {
      if (invalidated) throw new Error(invalidated)
      repository ??= openRepository(message => { invalidated = message })
      await (await repository).write({ ...document, schemaVersion: 2 })
    }
    if (selection) {
      let batch: SelectionResult['parts'] = [], vertices = 0
      for (const part of selection.parts) {
        batch.push(part); vertices += (part.selected.clip ? vertexCount(part.selected.clip) : 0) + (part.remainder?.clip ? vertexCount(part.remainder.clip) : 0)
        if (batch.length >= 64 || vertices >= 2048) { host.postMessage({ id, chunk: batch }); batch = []; vertices = 0 }
      }
      if (batch.length) host.postMessage({ id, chunk: batch })
      selection.parts = []
    }
    const used = new Set(strokes.map(stroke => stroke.geometry))
    for (const key of geometries.keys()) if (!used.has(key)) geometries.delete(key)
    pending = null; strokes = []
    host.postMessage({ id, ...(selection ? { selection } : {}) })
  } catch (error) { pending = null; strokes = []; host.postMessage({ id, error: error instanceof Error ? error.message : 'Ошибка обработки документа.' }) }
}
host.onmessage = ({ data }) => {
  if (data.type === 'close') { void (async () => { try { await (await repository)?.close(); host.postMessage({ id: data.id }) } catch (error) { host.postMessage({ id: data.id, error: String(error) }) } })(); return }
  if (data.type === 'start') { pending = data; strokes = []; return }
  if (!pending || data.id !== pending.id) return
  if (data.type === 'points') {
    let points = geometries.get(data.geometry)
    if (!points || points.length !== data.length) { points = new Array<Point>(data.length); geometries.set(data.geometry, points) }
    const chunk = pointsFromChunk(data.values)
    for (let i = 0; i < chunk.length; i++) points[data.offset + i] = chunk[i]!
  }
  if (data.type === 'strokes') strokes.push(...data.values)
  if (data.type === 'finish') void finish(data.id)
}
