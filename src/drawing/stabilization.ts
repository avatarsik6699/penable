import type { Point, Position, StabilizationMode, StabilizationProfile } from './types'

export const DEFAULT_STABILIZATION_STRENGTH = 65

export function normalizeStrength(value: number | StabilizationMode): number {
  if (typeof value === 'string') return value === 'light' ? 50 : value === 'strong' ? 100 : 0
  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

const PROFILES = {
  light: { minCutoff: 12, beta: 0.06, maxDeviation: 1.5 },
  strong: { minCutoff: 6, beta: 0.04, maxDeviation: 3 },
} as const

const DERIVATIVE_CUTOFF = 1
const FALLBACK_DT = 1 / 120

function alpha(cutoff: number, dt: number): number {
  return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt))
}

// Inspired by the 1€ filter. A shared cutoff and radial cap keep this variant isotropic.
export function stabilizedPositions(points: readonly Point[], profile?: StabilizationProfile): Position[] {
  const unique: Point[] = []
  for (const point of points) {
    const previous = unique.at(-1)
    if (!previous || point.x !== previous.x || point.y !== previous.y) unique.push(point)
  }
  const first = unique[0]
  const strength = normalizeStrength(profile?.strength ?? profile?.mode ?? 0)
  if (!first || strength === 0) return unique.map(({ x, y }) => ({ x, y }))
  const captureZoom = profile?.captureZoom ?? 1
  const zoom = Number.isFinite(captureZoom) && captureZoom > 0 ? captureZoom : 1
  const blend = Math.min(1, strength / 50)
  const t = (strength - 50) / 50
  const { light, strong } = PROFILES
  const { minCutoff, beta, maxDeviation } = strength <= 50 ? light : strength === 100 ? strong : {
    minCutoff: light.minCutoff + (strong.minCutoff - light.minCutoff) * t,
    beta: light.beta + (strong.beta - light.beta) * t,
    maxDeviation: light.maxDeviation + (strong.maxDeviation - light.maxDeviation) * t,
  }
  const output: Position[] = [{ x: first.x, y: first.y }]
  let previous = first
  let filteredX = first.x * zoom
  let filteredY = first.y * zoom
  let velocityX = 0
  let velocityY = 0

  for (let index = 1; index < unique.length; index++) {
    const point = unique[index]!
    const elapsed = (point.time - previous.time) / 1000
    const dt = Number.isFinite(elapsed) && elapsed > 0 ? elapsed : FALLBACK_DT
    const derivativeAlpha = alpha(DERIVATIVE_CUTOFF, dt)
    const rawX = point.x * zoom
    const rawY = point.y * zoom
    velocityX += derivativeAlpha * ((point.x - previous.x) * zoom / dt - velocityX)
    velocityY += derivativeAlpha * ((point.y - previous.y) * zoom / dt - velocityY)
    const positionAlpha = alpha(minCutoff + beta * Math.hypot(velocityX, velocityY), dt)
    filteredX += positionAlpha * (rawX - filteredX)
    filteredY += positionAlpha * (rawY - filteredY)
    const deviation = Math.hypot(filteredX - rawX, filteredY - rawY)
    if (deviation > maxDeviation) {
      const fraction = maxDeviation / deviation
      filteredX = rawX + (filteredX - rawX) * fraction
      filteredY = rawY + (filteredY - rawY) * fraction
    }
    output.push(strength < 50 ? {
      x: point.x + (filteredX / zoom - point.x) * blend,
      y: point.y + (filteredY / zoom - point.y) * blend,
    } : { x: filteredX / zoom, y: filteredY / zoom })
    previous = point
  }

  // Keep the exact tip in the output, while future samples still start from the capped state.
  const last = unique.at(-1)!
  output[output.length - 1] = { x: last.x, y: last.y }
  return output
}
