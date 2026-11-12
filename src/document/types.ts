import type { BackgroundMode } from '../drawing/background'
import type { Stroke, Viewport } from '../drawing/types'

export interface BoardDocument {
  format: 'penable-board'
  schemaVersion: 1
  strokes: Stroke[]
  viewport: Viewport
  background: BackgroundMode
  tools: { width: number; stabilization: number }
}

export interface DocumentRepository {
  read: () => Promise<{ main: StoredRecord; beforeImport: StoredRecord }>
  write: (document: BoardDocument) => Promise<void>
  replace: (previous: unknown, candidate: BoardDocument) => Promise<void>
  close: () => Promise<void>
}

export interface StoredRecord {
  exists: boolean
  value: unknown
}

export interface WriterLease {
  acquired: boolean
  message: string
  release: () => Promise<void>
}

export type SavePhase = 'loading' | 'dirty' | 'saving' | 'saved' | 'error'

export interface StorageState {
  phase: SavePhase
  loaded: boolean
  writable: boolean
  readOnly: boolean
  canImport: boolean
  importing: boolean
  hasPrevious: boolean
  canReconnect: boolean
  message: string
}
