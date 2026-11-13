import type { StrokeGeometry } from './geometry'
import { liveGeometry, sourceGeometry } from './source-geometry'
import { groupedStrokes, traceMask } from './regions'
import type { Stroke } from './types'

const paths = new WeakMap<StrokeGeometry, Path2D>()
function traceGeometry(target: CanvasRenderingContext2D | Path2D, geometry: Extract<StrokeGeometry, { kind: 'path' }>) {
  for (const command of geometry.commands) {
    if (command.kind === 'move') target.moveTo(command.x, command.y)
    else if (command.kind === 'line') target.lineTo(command.x, command.y)
    else target.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
  }
}
export interface StrokePaintState { color?: Stroke['color']; width?: number; configured?: boolean }
function style(ctx: CanvasRenderingContext2D, stroke: Stroke, state?: StrokePaintState) {
  if (!state || state.color !== stroke.color) { ctx.strokeStyle = stroke.color; ctx.fillStyle = stroke.color; if (state) state.color = stroke.color }
  if (!state || state.width !== stroke.width) { ctx.lineWidth = stroke.width; if (state) state.width = stroke.width }
  if (!state?.configured) { ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (state) state.configured = true }
}
export function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke, active = false, state?: StrokePaintState, translationHandled = false): void {
  // Renderer styles sit outside save/restore so the next stroke can reuse them.
  // Standalone callers retain the original Canvas state behavior.
  if (state) style(ctx, stroke, state)
  const transformed = Boolean(stroke.clip || (stroke.translation && !translationHandled))
  if (transformed) ctx.save()
  try {
    if (stroke.translation && !translationHandled) ctx.translate(stroke.translation.x, stroke.translation.y)
    if (stroke.clip) { traceMask(ctx, stroke.clip); ctx.clip('nonzero') }
    if (!state) style(ctx, stroke)
    const geometry = sourceGeometry(stroke, active)
    if (geometry.kind === 'empty') return
    ctx.beginPath()
    if (geometry.kind === 'dot') {
      ctx.arc(geometry.x, geometry.y, geometry.radius, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    if (typeof Path2D !== 'undefined') {
      let path = active ? liveGeometry(stroke).path() : paths.get(geometry)
      if (!path) { path = new Path2D(); traceGeometry(path, geometry); if (!active) paths.set(geometry, path) }
      ctx.stroke(path)
    } else { traceGeometry(ctx, geometry); ctx.stroke() }
  } finally { if (transformed) ctx.restore() }
}
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]): void {
  for (const stroke of groupedStrokes(strokes)) paintStroke(ctx, stroke)
}
