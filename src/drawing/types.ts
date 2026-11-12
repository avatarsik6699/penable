export const INK = '#182230' as const

export interface Point {
  x: number
  y: number
  pressure: number
  time: number
}

export interface Stroke {
  id: number
  color: typeof INK
  width: number
  points: Point[]
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
}
