export const INK = '#182230' as const

export interface Position {
  x: number
  y: number
}

export interface Viewport extends Position {
  zoom: number
}

export interface Point extends Position {
  pressure: number
  time: number
}

export type StabilizationMode = 'off' | 'light' | 'strong'

export type StabilizationProfile = {
  readonly captureZoom: number
} & (
  | { readonly strength: number; readonly mode?: never }
  | { readonly mode: StabilizationMode; readonly strength?: never }
)

export interface Stroke {
  id: number
  color: typeof INK
  width: number
  points: Point[]
  stabilization?: StabilizationProfile
}

export interface ActiveStroke extends Stroke {
  pointerId: number
}

export interface Scene {
  strokes: Stroke[]
  active: ActiveStroke | null
}

export interface PointerSample {
  pointerId: number
  clientX: number
  clientY: number
  pressure: number
  timeStamp: number
}

export interface PointerInput extends PointerSample {
  pointerType: string
  isPrimary: boolean
  button: number
  buttons: number
  getCoalescedEvents?: () => PointerSample[]
}

export interface InputDiagnostics {
  pointerType: string | null
  pressure: number | null
  active: boolean
  dpr: number
  coalesced: boolean
  zoom: number
  nativeScale: number
  requestedRatio: number
  effectiveRatio: number
  bitmapWidth: number
  bitmapHeight: number
  resolutionCapped: boolean
}

export interface SurfaceControls {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  undo: () => void
  redo: () => void
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  busy: boolean
}
