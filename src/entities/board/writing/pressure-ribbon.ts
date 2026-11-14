import type { PressureOutline, PressureDisc } from "./pressure-outline.types";
import type {
  PressureRibbon,
  PressureRibbonGeometry,
  RibbonSection,
} from "./pressure-ribbon.types";

const builders = new WeakMap<PressureOutline, IncrementalRibbon>();
const CHUNK_SEGMENTS = 256;

function section(
  point: PressureDisc,
  previous: PressureDisc,
  next: PressureDisc,
): RibbonSection {
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

  return {
    point,
    left: { x: point.x + nx * point.radius, y: point.y + ny * point.radius },
    right: { x: point.x - nx * point.radius, y: point.y - ny * point.radius },
    angle: Math.atan2(ny, nx),
  };
}

class IncrementalRibbon {
  private read = 0;
  private previous: PressureDisc | null = null;
  private pending: PressureDisc | null = null;
  private first: RibbonSection | null = null;
  private buffer: RibbonSection[] = [];
  private readonly chunks: RibbonSection[][] = [];
  private revision = -1;
  private result: PressureRibbonGeometry = null;

  update(outline: PressureOutline): PressureRibbonGeometry {
    if (this.revision === outline.revision) return this.result;

    for (; this.read < outline.stable.length; this.read++) {
      const segment = outline.stable[this.read]!;

      if (!this.pending) this.append(segment.a);

      this.append(segment.b);
    }

    const points: PressureDisc[] = this.pending ? [this.pending] : [];

    const append = (point: PressureDisc) => {
      const previous = points.at(-1);

      if (previous && previous.x === point.x && previous.y === point.y) {
        points[points.length - 1] = {
          ...point,
          radius: Math.max(previous.radius, point.radius),
        };

        return;
      }

      points.push(point);
    };

    for (const segment of outline.tail) {
      if (!points.length) append(segment.a);

      append(segment.b);
    }

    const tail = [...this.buffer];

    for (let i = 0; i < points.length; i++)
      tail.push(
        section(
          points[i]!,
          points[i - 1] ?? this.previous ?? points[i]!,
          points[i + 1] ?? points[i]!,
        ),
      );

    const first = this.first ?? tail[0],
      last = tail.at(-1);

    this.result =
      first && last ? { chunks: this.chunks, tail, first, last } : null;

    this.revision = outline.revision;

    return this.result;
  }

  private append(point: PressureDisc) {
    if (!this.pending) {
      this.pending = point;

      return;
    }

    if (point.x === this.pending.x && point.y === this.pending.y) {
      this.pending = {
        ...point,
        radius: Math.max(point.radius, this.pending.radius),
      };

      return;
    }

    const value = section(this.pending, this.previous ?? this.pending, point);

    this.first ??= value;
    this.buffer.push(value);

    if (this.buffer.length === CHUNK_SEGMENTS + 1) {
      this.chunks.push(this.buffer);
      this.buffer = [value];
    }

    this.previous = this.pending;
    this.pending = point;
  }
}

function geometry(outline: PressureOutline): PressureRibbonGeometry {
  let builder = builders.get(outline);

  if (!builder) {
    builder = new IncrementalRibbon();
    builders.set(outline, builder);
  }

  return builder.update(outline);
}

function ribbon(outline: PressureOutline): PressureRibbon {
  const value = geometry(outline);

  if (!value) return null;

  const sections = value.chunks
    .flatMap((chunk) => chunk.slice(0, -1))
    .concat([...value.tail]);

  return {
    left: sections.map((s) => s.left),
    right: sections.map((s) => s.right),
    first: value.first.point,
    last: value.last.point,
    startAngle: value.first.angle,
    endAngle: value.last.angle,
  };
}

export const PressureRibbons = { ribbon, geometry };
