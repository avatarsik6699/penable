import type { PathCommand, StrokeGeometry } from './geometry'
import { IncrementalStabilizer } from './stabilization'
import type { Point, Position, Stroke } from './types'

function samePosition(a: Position, b: Position): boolean { return a.x === b.x && a.y === b.y }
function trace(target: Path2D, command: PathCommand) {
  if (command.kind === 'move') target.moveTo(command.x, command.y)
  else if (command.kind === 'line') target.lineTo(command.x, command.y)
  else target.quadraticCurveTo(command.cx, command.cy, command.x, command.y)
}

// Internal append-only geometry. Stable commands never change; only the last
// quadratic and line are provisional. No raw point or accepted curve is simplified.
export class LiveStrokeGeometry {
  readonly points: Point[]
  readonly key: string
  private readonly filter: IncrementalStabilizer
  private readonly width: number
  private read = 0
  private filtered: Position | null = null
  private tip: Position | null = null
  private first: Position | null = null
  private last: Position | null = null
  private stablePositions = 0
  private prefixLength = 0
  private readonly commands: PathCommand[] = []
  private readonly curve: Extract<StrokeGeometry, { kind: 'path' }> = { kind: 'path', commands: this.commands }
  private current: StrokeGeometry = { kind: 'empty' }
  private prefixPath: Path2D | null = null
  private traced = 0

  constructor(stroke: Stroke, key: string) {
    this.points = stroke.points
    this.key = key
    this.width = stroke.width
    this.filter = new IncrementalStabilizer(stroke.stabilization)
  }

  matches(stroke: Stroke, key: string): boolean {
    return this.points === stroke.points && this.key === key && this.read <= stroke.points.length
  }

  update(): StrokeGeometry {
    let changed = false
    for (; this.read < this.points.length; this.read++) {
      const point = this.points[this.read]!
      const filtered = this.filter.append(point)
      if (!filtered) continue
      if (this.filtered) this.appendStable(this.filtered)
      this.filtered = filtered
      this.tip = { x: point.x, y: point.y }
      changed = true
    }
    if (changed) this.refreshTail()
    return this.current
  }

  path(): Path2D | null {
    if (this.current.kind !== 'path' || typeof Path2D === 'undefined') return null
    this.prefixPath ??= new Path2D()
    while (this.traced < this.prefixLength) trace(this.prefixPath, this.commands[this.traced++]!)
    // One stroke over the combined path preserves joins and overlapping antialiasing.
    // Cloning the native path avoids replaying the entire stable prefix through JS.
    const path = new Path2D(this.prefixPath)
    for (let index = this.prefixLength; index < this.commands.length; index++) trace(path, this.commands[index]!)
    return path
  }

  private appendStable(point: Position) {
    if (this.last && samePosition(this.last, point)) return
    this.commands.length = this.prefixLength
    if (!this.first) {
      this.first = point
      this.commands.push({ kind: 'move', x: point.x, y: point.y })
    } else if (this.stablePositions >= 2) {
      const last = this.last!
      this.commands.push({ kind: 'quadratic', cx: last.x, cy: last.y,
        x: (last.x + point.x) / 2, y: (last.y + point.y) / 2 })
    }
    this.prefixLength = this.commands.length
    this.last = point
    this.stablePositions++
  }

  private refreshTail() {
    const tip = this.tip!
    const first = this.first ?? tip
    const distinctTip = this.last && !samePosition(this.last, tip)
    const count = this.stablePositions + (distinctTip || !this.last ? 1 : 0)
    this.commands.length = this.prefixLength
    if (count === 1) {
      this.current = { kind: 'dot', x: first.x, y: first.y, radius: this.width / 2 }
      return
    }
    if (distinctTip && this.stablePositions >= 2) {
      const last = this.last!
      this.commands.push({ kind: 'quadratic', cx: last.x, cy: last.y,
        x: (last.x + tip.x) / 2, y: (last.y + tip.y) / 2 })
    }
    this.commands.push({ kind: 'line', x: tip.x, y: tip.y })
    this.current = this.curve
  }
}
