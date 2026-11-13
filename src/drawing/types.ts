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

export type DrawingTool = 'pen' | 'eraser' | 'selection'

export type StabilizationMode = 'off' | 'light' | 'strong'

export type StabilizationProfile = {
  readonly captureZoom: number
} & (
  | { readonly strength: number; readonly mode?: never }
  | { readonly mode: StabilizationMode; readonly strength?: never }
)

export type ClipMask = import('polygon-clipping').MultiPolygon
export type SelectionShape = 'rectangle' | 'lasso'
export type SelectionCommand = 'all' | 'clear' | 'copy' | 'cut' | 'paste' | 'delete' | 'duplicate' | 'image' | 'download'
export interface SelectionState { selected: boolean; clipboard: boolean; busy: boolean; message: string; png: boolean }

export interface Stroke {
  id: number
  color: typeof INK
  width: number
  points: Point[]
  stabilization?: StabilizationProfile
  source?: string
  clip?: ClipMask
  translation?: Position
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
  fitAll: () => void
  selection: (command: SelectionCommand) => void
  selectionShape: (shape: SelectionShape) => void
  undo: () => void
  redo: () => void
  snapshot: () => { strokes: Stroke[]; viewport: Viewport }
  isBusy: () => boolean
  cancelInput: () => void
}

export interface HistoryState {
  canUndo: boolean
  canRedo: boolean
  busy: boolean
}
