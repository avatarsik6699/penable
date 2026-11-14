import {
  BoardPressure,
  type PressureOutline,
  type Stroke,
  type RibbonSection,
} from "~/entities/board";
import type { RenderingContext } from "./rendering-context.types";

type Trace = Pick<RenderingContext, "moveTo" | "lineTo" | "arc" | "closePath">;

type NativeRibbon = {
  prefix: Path2D;
  read: number;
  revision: number;
  path: Path2D;
};

const paths = new WeakMap<PressureOutline, NativeRibbon>();

function strip(
  path: Trace,
  sections: readonly RibbonSection[],
  startCap = false,
  endCap = false,
) {
  const first = sections[0],
    last = sections.at(-1);

  if (!first || !last) return;

  if (sections.length === 1) {
    if (startCap && endCap) {
      path.moveTo(first.point.x + first.point.radius, first.point.y);

      path.arc(
        first.point.x,
        first.point.y,
        first.point.radius,
        0,
        Math.PI * 2,
      );

      path.closePath();
    }

    return;
  }

  path.moveTo(first.left.x, first.left.y);

  for (let i = 1; i < sections.length; i++) {
    const point = sections[i]!.left;

    path.lineTo(point.x, point.y);
  }

  if (endCap)
    path.arc(
      last.point.x,
      last.point.y,
      last.point.radius,
      last.angle,
      last.angle - Math.PI,
      true,
    );
  else path.lineTo(last.right.x, last.right.y);

  for (let i = sections.length - 2; i >= 0; i--) {
    const point = sections[i]!.right;

    path.lineTo(point.x, point.y);
  }

  if (startCap)
    path.arc(
      first.point.x,
      first.point.y,
      first.point.radius,
      first.angle - Math.PI,
      first.angle - Math.PI * 2,
      true,
    );

  path.closePath();
}

function paint(ctx: RenderingContext, stroke: Stroke, active: boolean) {
  const outline = BoardPressure.outline(stroke, active),
    geometry = BoardPressure.ribbonGeometry(outline);

  if (!geometry) return;

  if (typeof Path2D !== "undefined") {
    let cached = paths.get(outline);

    if (!cached) {
      const prefix = new Path2D();

      cached = { prefix, read: 0, revision: -1, path: prefix };
      paths.set(outline, cached);
    }

    if (cached.revision !== outline.revision) {
      for (; cached.read < geometry.chunks.length; cached.read++)
        strip(
          cached.prefix,
          geometry.chunks[cached.read]!,
          cached.read === 0,
          false,
        );

      const path = new Path2D(cached.prefix);

      strip(path, geometry.tail, geometry.chunks.length === 0, true);
      cached.path = path;
      cached.revision = outline.revision;
    }

    ctx.fill(cached.path, "nonzero");
  } else {
    ctx.beginPath();

    geometry.chunks.forEach((chunk, index) =>
      strip(ctx, chunk, index === 0, false),
    );

    strip(ctx, geometry.tail, geometry.chunks.length === 0, true);
    ctx.fill("nonzero");
  }
}

export const PressurePaint = { paint };
