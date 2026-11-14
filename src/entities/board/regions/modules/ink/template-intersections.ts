import type { ClipMask, Position, TemplateItem } from "../../../board.types";
import { BoardTemplates, type TemplatePrimitive } from "../../../templates";
import { RegionMask } from "../mask";
import { InkUtils } from "./ink.utils";

const verticesCache = new WeakMap<TemplatePrimitive, readonly Position[]>();

function vertices(
  primitive: Exclude<TemplatePrimitive, { kind: "text" }>,
): readonly Position[] {
  if (primitive.kind !== "ellipse") return primitive.points;

  const known = verticesCache.get(primitive);

  if (known) return known;

  const count = Math.max(
    64,
    Math.ceil(Math.PI * Math.sqrt(Math.max(primitive.rx, primitive.ry) / 0.02)),
  );

  const result = Array.from({ length: count }, (_, i) => ({
    x: primitive.cx + primitive.rx * Math.cos((i / count) * Math.PI * 2),
    y: primitive.cy + primitive.ry * Math.sin((i / count) * Math.PI * 2),
  }));

  verticesCache.set(primitive, result);

  return result;
}

function polygonIntersects(
  points: readonly Position[],
  mask: ClipMask,
  filled: boolean,
  width: number,
  closed: boolean,
): boolean {
  if (filled) {
    const ring = points.map((p) => [p.x, p.y] as [number, number]);
    const polygon = [[[...ring, ring[0]!]]];

    if (
      points.some((p) => RegionMask.contains(mask, p)) ||
      RegionMask.maskEdges(mask).some(({ a }) =>
        RegionMask.contains(polygon, a),
      )
    )
      return true;
  }

  for (let i = 1; i < points.length + (closed ? 1 : 0); i++) {
    const a = points[i - 1]!,
      b = points[i % points.length]!;

    if (RegionMask.contains(mask, a) || RegionMask.contains(mask, b))
      return true;

    for (const edge of RegionMask.maskEdges(mask))
      if (RegionMask.segmentDistance(a, b, edge.a, edge.b) <= width / 2)
        return true;
  }

  return false;
}

function intersects(item: TemplateItem, mask: ClipMask): boolean {
  const bounds = RegionMask.maskBounds(mask);

  if (!bounds) return false;

  for (const primitive of BoardTemplates.layout(item.template).primitives) {
    if (primitive.kind === "text") {
      if (
        !InkUtils.overlaps(bounds, {
          left: primitive.x,
          top: primitive.y,
          right: primitive.x + primitive.width,
          bottom: primitive.y + primitive.height,
        })
      )
        continue;

      const points = [
        { x: primitive.x, y: primitive.y },
        { x: primitive.x + primitive.width, y: primitive.y },
        { x: primitive.x + primitive.width, y: primitive.y + primitive.height },
        { x: primitive.x, y: primitive.y + primitive.height },
      ];

      if (polygonIntersects(points, mask, true, 0, true)) return true;
    } else if (
      polygonIntersects(
        vertices(primitive),
        mask,
        primitive.fill !== null,
        primitive.width,
        primitive.kind === "ellipse" || primitive.closed,
      )
    )
      return true;
  }

  return false;
}

export const TemplateIntersections = { intersects };
