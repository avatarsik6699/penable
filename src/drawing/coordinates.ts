import type { Point, PointerSample } from './types'

export interface SurfaceBounds {
  left: number
  top: number
}

// Scene units are CSS pixels. Only the renderer knows the bitmap's DPR.
export function toScenePoint(sample: PointerSample, bounds: SurfaceBounds): Point | null {
  const x = sample.clientX - bounds.left
  const y = sample.clientY - bounds.top
  if (![x, y, sample.pressure, sample.timeStamp].every(Number.isFinite)) return null
  return { x, y, pressure: sample.pressure, time: sample.timeStamp }
}

export function validDpr(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

export function bitmapSize(width: number, height: number, dpr: number) {
  const ratio = validDpr(dpr)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}
