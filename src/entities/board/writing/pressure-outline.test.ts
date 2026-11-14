import { describe, expect, it } from "vitest";
import { BoardConstants, type Stroke } from "../board.types";
import { BoardPressure, LivePressureOutline } from "./pressure-outline";

function fixture(): Stroke {
  return {
    id: 1,
    color: BoardConstants.INK,
    width: 8,
    style: { instrument: "pressure", opacity: 1, pressureStrength: 100 },
    stabilization: { strength: 65, captureZoom: 2 },
    points: Array.from({ length: 80 }, (_, i) => ({
      x: i * 2,
      y: Math.sin(i / 6) * 10,
      pressure: i / 79,
      time: i * 8,
    })),
  };
}

describe("pressure outline", () => {
  it("maps pressure monotonically while strength zero preserves a constant width", () => {
    const stroke = fixture();

    expect(BoardPressure.radius(stroke, 0)).toBeCloseTo(0.6);
    expect(BoardPressure.radius(stroke, 1)).toBe(4);

    expect(
      BoardPressure.radius(
        { ...stroke, style: { ...stroke.style!, pressureStrength: 0 } },
        0,
      ),
    ).toBe(4);
  });

  it("produces identical geometry from incremental event batches and a completed stroke", () => {
    const source = fixture(),
      active = { ...source, points: source.points.slice(0, 1) };

    const builder = new LivePressureOutline(active);

    builder.update();

    for (let offset = 1; offset < source.points.length; offset += 3) {
      active.points.push(...source.points.slice(offset, offset + 3));
      builder.update();
    }

    const incremental = builder.update(),
      batch = BoardPressure.outline(source);

    expect(incremental.stable).toEqual(batch.stable);
    expect(incremental.tail).toEqual(batch.tail);
    expect(incremental.first).toEqual(batch.first);

    expect(incremental.tail.at(-1)!.b).toMatchObject({
      x: source.points.at(-1)!.x,
      y: source.points.at(-1)!.y,
    });

    expect(
      incremental.stable.every(({ a, b }) =>
        [a.x, a.y, a.radius, b.x, b.y, b.radius].every(Number.isFinite),
      ),
    ).toBe(true);
  });

  it("reuses completed outline and query arrays across affine and clipped fragments", () => {
    const stroke = fixture(),
      fragment = { ...stroke, id: 2, translation: { x: 20, y: 30 } };

    expect(BoardPressure.outline(fragment)).toBe(BoardPressure.outline(stroke));

    expect(BoardPressure.segments(fragment)).toBe(
      BoardPressure.segments(stroke),
    );

    expect(BoardPressure.outline({ ...stroke, width: 4 })).not.toBe(
      BoardPressure.outline(stroke),
    );
  });

  it("keeps a one-point contact and stationary pressure updates finite", () => {
    const stroke = fixture();

    stroke.points = [
      { x: 10, y: 10, time: 0, pressure: 0 },
      { x: 10, y: 10, time: 2, pressure: 1 },
    ];

    const segments = BoardPressure.segments(stroke);

    expect(segments).toHaveLength(1);
    expect(segments[0]!.b.radius).toBe(4);
  });

  it("retains the last painted contact width when pointerup reports zero pressure at the same position", () => {
    const stroke = fixture();

    stroke.points = stroke.points.slice(0, 5);

    const builder = new LivePressureOutline(stroke),
      before = builder.update().tail.at(-1)!.b.radius;

    stroke.points.push({ ...stroke.points.at(-1)!, pressure: 0, time: 100 });
    expect(builder.update().tail.at(-1)!.b.radius).toBe(before);
  });
});
