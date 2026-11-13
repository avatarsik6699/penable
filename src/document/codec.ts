import { cloneMask, normalizeMask, REGION_LIMITS, vertexCount } from '../drawing/regions'
import type { ClipMask } from '../drawing/types'
import { INK, type Point, type StabilizationProfile, type Stroke } from '../drawing/types'
import type { BoardDocument } from './types'

export const DOCUMENT_LIMITS = { bytes: 64 * 1024 * 1024, strokes: 20_000, points: 1_000_000, pointsPerStroke: 100_000 }
export const MAX_STROKE_ID = Number.MAX_SAFE_INTEGER - 1_000_000
const COORDINATE_LIMIT = 1e9

export function emptyDocument(): BoardDocument {
  return { format: 'penable-board', schemaVersion: 2, strokes: [], viewport: { zoom: 1, x: 0, y: 0 },
    background: 'blank', tools: { width: 3, stabilization: 65 } }
}

export function cloneDocument(document: BoardDocument): BoardDocument {
  return {
    format: 'penable-board', schemaVersion: document.schemaVersion,
    strokes: document.strokes.map((stroke) => {
      const result: Stroke = { id: stroke.id, color: stroke.color, width: stroke.width,
        points: stroke.points.map((point) => ({ x: point.x, y: point.y, pressure: point.pressure, time: point.time })) }
      if (stroke.stabilization) {
        const profile = stroke.stabilization
        result.stabilization = profile.strength !== undefined
          ? { strength: profile.strength, captureZoom: profile.captureZoom }
          : { mode: profile.mode, captureZoom: profile.captureZoom }
      }
      if (stroke.source !== undefined) result.source = stroke.source
      if (stroke.translation) result.translation = { ...stroke.translation }
      if (stroke.clip) result.clip = cloneMask(stroke.clip)
      return result
    }),
    viewport: { zoom: document.viewport.zoom, x: document.viewport.x, y: document.viewport.y },
    background: document.background,
    tools: { width: document.tools.width, stabilization: document.tools.stabilization },
  }
}

function invalid(field: string): never { throw new Error(`Недопустимые данные: ${field}.`) }
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid(field)
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return invalid(field)
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    if (Object.hasOwn(value, key)) return invalid(`${field}.${key}`)
  }
  return value as Record<string, unknown>
}
function own(value: Record<string, unknown>, key: string): unknown {
  if (!Object.hasOwn(value, key)) return invalid(key)
  return value[key]
}
function number(value: unknown, min: number, max: number, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return invalid(field)
  return value
}
function coordinate(value: unknown, field: string) { return number(value, -COORDINATE_LIMIT, COORDINATE_LIMIT, field) }

export function decodeDocument(value: unknown, limits = DOCUMENT_LIMITS): BoardDocument {
  const root = object(value, 'document')
  const schemaVersion = own(root, 'schemaVersion')
  if (own(root, 'format') !== 'penable-board' || (schemaVersion !== 1 && schemaVersion !== 2)) invalid('format/schemaVersion')
  const strokes = own(root, 'strokes')
  if (!Array.isArray(strokes) || strokes.length > limits.strokes) invalid('strokes: превышен предел')
  for (let index = 0; index < strokes.length; index++) if (!Object.hasOwn(strokes, index)) invalid('strokes: пропущен элемент')
  let totalPoints = 0
  const ids = new Set<number>()
  const sources = new Map<string, string>()
  let totalVertices = 0
  const decoded: Stroke[] = strokes.map((entry: unknown) => {
    const stroke = object(entry, 'stroke')
    const id = number(own(stroke, 'id'), 1, MAX_STROKE_ID, 'stroke.id')
    if (!Number.isSafeInteger(id) || ids.has(id)) invalid('stroke.id: повтор/небезопасное число')
    ids.add(id)
    if (own(stroke, 'color') !== INK) invalid('stroke.color')
    const rawPoints = own(stroke, 'points')
    if (!Array.isArray(rawPoints) || !rawPoints.length || rawPoints.length > limits.pointsPerStroke) invalid('stroke.points: превышен предел/пусто')
    for (let index = 0; index < rawPoints.length; index++) if (!Object.hasOwn(rawPoints, index)) invalid('stroke.points: пропущен элемент')
    totalPoints += rawPoints.length
    if (totalPoints > limits.points) invalid('points: превышен общий предел')
    const points: Point[] = rawPoints.map((entry: unknown) => {
      const point = object(entry, 'point')
      return { x: coordinate(own(point, 'x'), 'point.x'), y: coordinate(own(point, 'y'), 'point.y'),
        pressure: number(own(point, 'pressure'), 0, 1, 'point.pressure'), time: number(own(point, 'time'), 0, Number.MAX_VALUE, 'point.time') }
    })
    const result: Stroke = { id, color: INK, width: number(own(stroke, 'width'), 0.5, 12, 'stroke.width'), points }
    if (Object.hasOwn(stroke, 'stabilization')) {
      const profile = object(stroke.stabilization, 'stabilization')
      const captureZoom = number(own(profile, 'captureZoom'), 0.25, 8, 'captureZoom')
      if (Object.hasOwn(profile, 'strength') === Object.hasOwn(profile, 'mode')) invalid('stabilization: нужен strength или mode')
      let stabilization: StabilizationProfile
      if (Object.hasOwn(profile, 'strength')) stabilization = { strength: number(profile.strength, 0, 100, 'strength'), captureZoom }
      else {
        const mode = own(profile, 'mode')
        if (mode !== 'off' && mode !== 'light' && mode !== 'strong') invalid('mode')
        stabilization = { mode, captureZoom }
      }
      result.stabilization = stabilization
    }
    if (schemaVersion === 2) {
      if (Object.hasOwn(stroke, 'source')) {
        if (typeof stroke.source !== 'string' || !/^[a-zA-Z0-9_-]{1,160}$/.test(stroke.source)) invalid('stroke.source')
        result.source = stroke.source as string
      }
      if (Object.hasOwn(stroke, 'translation')) {
        const offset = object(stroke.translation, 'translation')
        result.translation = { x: coordinate(own(offset, 'x'), 'translation.x'), y: coordinate(own(offset, 'y'), 'translation.y') }
      }
      if (Object.hasOwn(stroke, 'clip')) {
        result.clip = decodeMask(stroke.clip)
        totalVertices += vertexCount(result.clip)
        if (totalVertices > REGION_LIMITS.document) invalid('clip: превышен общий предел 100000 вершин')
      }
      if ((result.clip || result.translation) && !result.source) invalid('stroke.source: требуется для фрагмента')
      if (result.source) {
        const signature = JSON.stringify({ color: result.color, width: result.width, points: result.points, stabilization: result.stabilization })
        const previous = sources.get(result.source)
        if (previous && previous !== signature) invalid('stroke.source: несовместимая исходная геометрия')
        sources.set(result.source, signature)
      }
    }
    return result
  })
  const viewport = object(own(root, 'viewport'), 'viewport')
  const tools = object(own(root, 'tools'), 'tools')
  const background = own(root, 'background')
  if (background !== 'blank' && background !== 'dots' && background !== 'grid') invalid('background')
  const result: BoardDocument = { format: 'penable-board', schemaVersion: schemaVersion as 1 | 2, strokes: decoded,
    viewport: { zoom: number(own(viewport, 'zoom'), 0.25, 8, 'viewport.zoom'), x: coordinate(own(viewport, 'x'), 'viewport.x'), y: coordinate(own(viewport, 'y'), 'viewport.y') },
    background, tools: { width: number(own(tools, 'width'), 0.5, 12, 'tools.width'), stabilization: number(own(tools, 'stabilization'), 0, 100, 'tools.stabilization') } }
  if (new TextEncoder().encode(JSON.stringify(result)).byteLength > limits.bytes) invalid('размер документа превышает 64 MiB')
  return result
}

function decodeMask(value: unknown): ClipMask {
  if (!Array.isArray(value) || !value.length) invalid('clip: пустая маска')
  let vertices = 0
  const mask: ClipMask = value.map((polygon: unknown) => {
    if (!Array.isArray(polygon) || !polygon.length) invalid('clip.polygon')
    return polygon.map((ring: unknown) => {
      if (!Array.isArray(ring) || ring.length < 4) invalid('clip.ring')
      vertices += ring.length
      if (vertices > REGION_LIMITS.mask) invalid('clip: превышен предел 8192 вершин')
      const points: [number, number][] = ring.map((pair: unknown) => {
        if (!Array.isArray(pair) || pair.length !== 2) invalid('clip.point')
        return [coordinate(pair[0], 'clip.x'), coordinate(pair[1], 'clip.y')]
      })
      if (points[0]![0] !== points.at(-1)![0] || points[0]![1] !== points.at(-1)![1]) invalid('clip: незамкнутая граница')
      return points
    })
  })
  // Normalized topology has closed, nonintersecting outer/hole rings. Reject malformed
  // input, rather than silently repairing a backup and revealing hidden writing.
  const normalized = normalizeMask(mask)
  if (JSON.stringify(normalized) !== JSON.stringify(mask)) invalid('clip: требуется нормализованная топология')
  return normalized
}

export function parseDocumentJSON(text: string): BoardDocument {
  if (new TextEncoder().encode(text).byteLength > DOCUMENT_LIMITS.bytes) throw new Error('Файл превышает 64 MiB.')
  return decodeDocument(JSON.parse(text) as unknown)
}

export function serializeDocument(document: BoardDocument): { json: string; warning: string } {
  const json = JSON.stringify(cloneDocument(document))
  let warning = ''
  try { parseDocumentJSON(json) } catch {
    warning = 'Копия содержит все завершённые данные, но выходит за пределы поддерживаемого формата. Обратный импорт этой версией не поддерживается.'
  }
  return { json, warning }
}

export function documentStats(document: BoardDocument) {
  return { strokes: document.strokes.length, points: document.strokes.reduce((sum, stroke) => sum + stroke.points.length, 0) }
}

export function serializeRawBackup(value: unknown): string {
  const seen = new Set<object>()
  const compatible = (entry: unknown): boolean => {
    if (entry === null || typeof entry === 'string' || typeof entry === 'boolean') return true
    if (typeof entry === 'number') return Number.isFinite(entry)
    if (typeof entry !== 'object' || seen.has(entry)) return false
    seen.add(entry)
    const array = Array.isArray(entry)
    const prototype = Object.getPrototypeOf(entry)
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return false
    const keys = Reflect.ownKeys(entry)
    if (array) {
      if (keys.length !== entry.length + 1) return false
      for (let index = 0; index < entry.length; index++) if (!Object.hasOwn(entry, index)) return false
    }
    for (const key of keys) {
      if (array && key === 'length') continue
      if (typeof key !== 'string') return false
      const descriptor = Object.getOwnPropertyDescriptor(entry, key)
      if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value') || !compatible(descriptor.value)) return false
    }
    return true
  }
  try {
    if (!compatible(value)) throw new Error('unsupported')
    return JSON.stringify(value)
  } catch {
    throw new Error('Исходная запись не представима в JSON без потери данных. Она сохранена в IndexedDB без изменений; JSON-копия не создана.')
  }
}
