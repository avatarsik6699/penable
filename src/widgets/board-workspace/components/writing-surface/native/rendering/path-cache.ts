import type { RenderingContext } from "./rendering-context.types";
import type {
  ClipMask,
  LiveStrokeGeometry,
  PathCommand,
  StrokeGeometry,
} from "~/entities/board";

const livePaths = new WeakMap<
  LiveStrokeGeometry,
  {
    prefix: Path2D;
    traced: number;
  }
>();

function trace(target: RenderingContext | Path2D, command: PathCommand) {
  if (command.kind === "move") target.moveTo(command.x, command.y);
  else if (command.kind === "line") target.lineTo(command.x, command.y);
  else target.quadraticCurveTo(command.cx, command.cy, command.x, command.y);
}

function livePath(live: LiveStrokeGeometry): Path2D | null {
  const geometry = live.update();

  if (geometry.kind !== "path" || typeof Path2D === "undefined") return null;

  let cached = livePaths.get(live);

  if (!cached) {
    cached = { prefix: new Path2D(), traced: 0 };
    livePaths.set(live, cached);
  }

  while (cached.traced < live.stablePrefixLength)
    trace(cached.prefix, geometry.commands[cached.traced++]!);

  const path = new Path2D(cached.prefix);

  for (
    let index = live.stablePrefixLength;
    index < geometry.commands.length;
    index++
  )
    trace(path, geometry.commands[index]!);

  return path;
}

function traceGeometry(
  target: RenderingContext | Path2D,
  geometry: Extract<
    StrokeGeometry,
    {
      kind: "path";
    }
  >,
) {
  for (const command of geometry.commands) trace(target, command);
}

function traceMask(ctx: RenderingContext, mask: ClipMask): void {
  ctx.beginPath();

  for (const polygon of mask)
    for (const ring of polygon) {
      if (!ring.length) continue;

      ctx.moveTo(...ring[0]!);

      for (let i = 1; i < ring.length; i++) ctx.lineTo(...ring[i]!);

      ctx.closePath();
    }
}

export const BoardPaths = { livePath, traceGeometry, traceMask };
