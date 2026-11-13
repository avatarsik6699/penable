import { strokeGeometry } from './geometry'
import { stabilizedPositions } from './stabilization'
import { groupedStrokes, traceMask } from './regions'
import type { Stroke } from './types'

export function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const transformed = Boolean(stroke.clip || stroke.translation)
  if (transformed) ctx.save()
  try {
    if (stroke.translation) ctx.translate(stroke.translation.x, stroke.translation.y)
    if (stroke.clip) { traceMask(ctx, stroke.clip); ctx.clip('nonzero') }
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const geometry = strokeGeometry(stabilizedPositions(stroke.points, stroke.stabilization), stroke.width)
    if (geometry.kind === 'empty') return
    ctx.beginPath()
    if (geometry.kind === 'dot') {
      ctx.arc(geometry.x, geometry.y, geometry.radius, 0, Math.PI * 2)
      ctx.fill()
      return
    }
    for (const command of geometry.commands) {
      if (command.kind === 'move') ctx.moveTo(command.x, command.y)
      else if (command.kind === 'line') ctx.lineTo(command.x, command.y)
      else ctx.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
    }
    ctx.stroke()
  } finally { if (transformed) ctx.restore() }
}
export function paintStrokes(ctx: CanvasRenderingContext2D, strokes: readonly Stroke[]): void {
  for (const stroke of groupedStrokes(strokes)) paintStroke(ctx, stroke)
}
