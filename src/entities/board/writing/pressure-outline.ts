import { PressureRibbons } from "./pressure-ribbon";
import type { Stroke } from "../board.types";
import { IncrementalStabilizer } from "../geometry";
import type {
  PressureDisc,
  PressureSegment,
  PressureOutline,
} from "./pressure-outline.types";

const shared = new WeakMap<Stroke["points"], Map<string, PressureOutline>>();

const querySegments = new WeakMap<
  PressureOutline,
  readonly PressureSegment[]
>();

const completed = new WeakMap<Stroke, PressureOutline>();
const live = new WeakMap<Stroke, LivePressureOutline>();

function radius(stroke: Stroke, pressure: number): number {
  const strength = (stroke.style?.pressureStrength ?? 65) / 100;

  return (
    (stroke.width / 2) *
    (1 - strength * 0.85 * (1 - Math.max(0, Math.min(1, pressure))))
  );
}

function midpoint(a: PressureDisc, b: PressureDisc): PressureDisc {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    radius: (a.radius + b.radius) / 2,
  };
}

function curve(
  a: PressureDisc,
  control: PressureDisc,
  b: PressureDisc,
  result: PressureSegment[],
) {
  const error =
    Math.hypot(a.x - 2 * control.x + b.x, a.y - 2 * control.y + b.y) / 4;

  const count = Math.min(64, Math.max(1, Math.ceil(Math.sqrt(error / 0.01))));
  let previous = a;

  for (let i = 1; i <= count; i++) {
    const t = i / count,
      u = 1 - t;

    const point = {
      x: u * u * a.x + 2 * u * t * control.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * control.y + t * t * b.y,
      radius: u * u * a.radius + 2 * u * t * control.radius + t * t * b.radius,
    };

    result.push({ a: previous, b: point });
    previous = point;
  }
}

export class LivePressureOutline {
  private read = 0;
  private readonly filter: IncrementalStabilizer;
  private filtered: PressureDisc | null = null;
  private last: PressureDisc | null = null;
  private first: PressureDisc | null = null;
  private end: PressureDisc | null = null;
  private tip: PressureDisc | null = null;
  private readonly stable: PressureSegment[] = [];
  private readonly tail: PressureSegment[] = [];
  private readonly outline: PressureOutline;

  constructor(private readonly stroke: Stroke) {
    this.filter = new IncrementalStabilizer(stroke.stabilization);

    this.outline = {
      revision: 0,
      stable: this.stable,
      tail: this.tail,
      first: null,
    };
  }

  update(): PressureOutline {
    let changed = false;

    for (; this.read < this.stroke.points.length; this.read++) {
      const point = this.stroke.points[this.read]!;
      const filtered = this.filter.append(point);

      const contactRadius = radius(this.stroke, point.pressure);

      const stationary =
        this.tip && this.tip.x === point.x && this.tip.y === point.y;

      this.tip = {
        x: point.x,
        y: point.y,
        radius: stationary
          ? Math.max(this.tip!.radius, contactRadius)
          : contactRadius,
      };

      changed = true;

      if (!filtered) {
        if (this.filtered)
          this.filtered = {
            ...this.filtered,
            radius: Math.max(this.filtered.radius, this.tip.radius),
          };

        continue;
      }

      if (this.filtered) this.append(this.filtered);

      this.filtered = { ...filtered, radius: this.tip.radius };
    }

    if (changed) {
      this.outline.revision++;
      this.tail.length = 0;

      if (this.tip) {
        if (this.last && this.end)
          curve(this.end, this.last, this.tip, this.tail);
        else if (this.first) this.tail.push({ a: this.first, b: this.tip });
        else this.tail.push({ a: this.tip, b: this.tip });
      }
    }

    return this.outline;
  }

  private append(point: PressureDisc) {
    if (!this.first) {
      this.first = point;
      this.end = point;
      (this.outline as { first: PressureDisc | null }).first = point;
    } else if (this.last && this.end) {
      const end = midpoint(this.last, point);

      curve(this.end, this.last, end, this.stable);
      this.end = end;
    }

    this.last = point;
  }
}

function outline(stroke: Stroke, active = false): PressureOutline {
  const key = JSON.stringify([
    stroke.width,
    stroke.style,
    stroke.stabilization,
  ]);

  const known = completed.get(stroke) ?? shared.get(stroke.points)?.get(key);

  if (known && !active) {
    completed.set(stroke, known);

    return known;
  }

  let builder = live.get(stroke);

  if (!builder) {
    builder = new LivePressureOutline(stroke);
    live.set(stroke, builder);
  }

  const result = builder.update();

  if (!active) {
    completed.set(stroke, result);
    live.delete(stroke);

    const cache =
      shared.get(stroke.points) ?? new Map<string, PressureOutline>();

    cache.set(key, result);
    shared.set(stroke.points, cache);
  }

  return result;
}

function segments(stroke: Stroke): readonly PressureSegment[] {
  const value = outline(stroke);
  let result = querySegments.get(value);

  if (!result) {
    result = [...value.stable, ...value.tail];
    querySegments.set(value, result);
  }

  return result;
}

export const BoardPressure = {
  radius,
  outline,
  segments,
  ribbon: PressureRibbons.ribbon,
  ribbonGeometry: PressureRibbons.geometry,
};
