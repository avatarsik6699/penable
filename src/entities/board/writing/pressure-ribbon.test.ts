import { describe, expect, it } from "vitest";
import { BoardConstants, type Stroke } from "../board.types";
import { BoardPressure, LivePressureOutline } from "./pressure-outline";
import { PressureRibbonReference } from "./pressure-ribbon-reference.fixture";

function fixture(kind: string): Stroke {
  const points = Array.from({ length: 1600 }, (_, i) => ({
    x: kind === "reverse" ? Math.abs(400 - (i % 800)) : i / 8,
    y: kind === "loops" ? 20 * Math.sin(i / 20) : 0,
    pressure: (i % 13) / 12,
    time: i * 8,
  }));

  if (kind === "duplicate")
    for (let i = 8; i < points.length; i += 17) {
      points[i]!.x = points[i - 1]!.x;
      points[i]!.y = points[i - 1]!.y;
    }

  return {
    id: 1,
    color: BoardConstants.INK,
    width: 8,
    style: { instrument: "pressure", opacity: 1, pressureStrength: 100 },
    stabilization: { strength: 0, captureZoom: 1 },
    points,
  };
}

describe("incremental pressure ribbon", () => {
  it.each(["line", "reverse", "loops", "duplicate"])(
    "matches the full-contour reference at every bounded update for %s",
    (kind) => {
      const source = fixture(kind),
        active = { ...source, points: source.points.slice(0, 1) },
        builder = new LivePressureOutline(active);

      for (let offset = 1; offset <= source.points.length; offset += 31) {
        active.points.push(...source.points.slice(offset, offset + 31));

        const outline = builder.update();

        expect(BoardPressure.ribbon(outline)).toEqual(
          PressureRibbonReference.ribbon(outline),
        );

        const geometry = BoardPressure.ribbonGeometry(outline)!;

        expect(geometry.tail.length).toBeLessThan(400);

        expect(geometry.chunks.every((chunk) => chunk.length === 257)).toBe(
          true,
        );
      }
    },
  );

  it("matches the reference from the first contact through every early prefix", () => {
    const source = fixture("loops"),
      active: Stroke = { ...source, points: [] },
      builder = new LivePressureOutline(active);

    for (const point of source.points.slice(0, 80)) {
      active.points.push(point);

      const outline = builder.update();

      expect(BoardPressure.ribbon(outline)).toEqual(
        PressureRibbonReference.ribbon(outline),
      );
    }
  });

  it("reuses every sealed chunk after subsequent samples", () => {
    const source = fixture("loops"),
      active = { ...source, points: source.points.slice(0, 900) },
      builder = new LivePressureOutline(active);

    const outline = builder.update(),
      first = BoardPressure.ribbonGeometry(outline)!.chunks[0];

    active.points.push(...source.points.slice(900));
    builder.update();
    expect(BoardPressure.ribbonGeometry(outline)!.chunks[0]).toBe(first);
  });
});
