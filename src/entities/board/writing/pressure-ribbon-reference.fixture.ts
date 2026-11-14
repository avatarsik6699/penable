import type { PressureOutline, PressureDisc } from "./pressure-outline.types";
import type { PressureRibbon } from "./pressure-ribbon.types";

function ribbon(outline: PressureOutline): PressureRibbon {
  const points: PressureDisc[] = [];

  const append = (point: PressureDisc) => {
    const previous = points.at(-1);

    if (previous && point.x === previous.x && point.y === previous.y) {
      points[points.length - 1] = {
        ...point,
        radius: Math.max(previous.radius, point.radius),
      };

      return;
    }

    points.push(point);
  };

  for (const segment of outline.stable) {
    if (!points.length) append(segment.a);

    append(segment.b);
  }

  for (const segment of outline.tail) {
    if (!points.length) append(segment.a);

    append(segment.b);
  }

  const first = points[0],
    last = points.at(-1);

  if (!first || !last) return null;

  const left: Array<{ x: number; y: number }> = [],
    right: Array<{ x: number; y: number }> = [];

  let startAngle = 0,
    endAngle = 0;

  for (let i = 0; i < points.length; i++) {
    const point = points[i]!,
      previous = points[i - 1] ?? point,
      next = points[i + 1] ?? point;

    const incoming = Math.hypot(point.x - previous.x, point.y - previous.y),
      outgoing = Math.hypot(next.x - point.x, next.y - point.y);

    const ax = incoming
      ? -(point.y - previous.y) / incoming
      : outgoing
        ? -(next.y - point.y) / outgoing
        : 0;

    const ay = incoming
      ? (point.x - previous.x) / incoming
      : outgoing
        ? (next.x - point.x) / outgoing
        : 1;

    const bx = outgoing ? -(next.y - point.y) / outgoing : ax,
      by = outgoing ? (next.x - point.x) / outgoing : ay;

    const sum = Math.hypot(ax + bx, ay + by);

    const nx = sum > 0.0001 ? (ax + bx) / sum : ax,
      ny = sum > 0.0001 ? (ay + by) / sum : ay;

    const radius = point.radius;

    left.push({ x: point.x + nx * radius, y: point.y + ny * radius });
    right.push({ x: point.x - nx * radius, y: point.y - ny * radius });

    if (i === 0) startAngle = Math.atan2(ny, nx);

    if (i === points.length - 1) endAngle = Math.atan2(ny, nx);
  }

  return { left, right, first, last, startAngle, endAngle };
}

export const PressureRibbonReference = { ribbon };
