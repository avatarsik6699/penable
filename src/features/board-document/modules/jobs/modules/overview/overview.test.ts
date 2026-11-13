import { describe, expect, it } from "vitest";
import { DocumentOverview } from "./overview";
import { BoardRegions, type Stroke } from "~/entities/board";

function stroke(id: number, x: number, y: number): Stroke {
  return {
    id,
    color: "#182230",
    width: 2,
    points: [
      { x, y, time: 0, pressure: 1 },
      { x: x + 20, y: y + 10, time: 1, pressure: 0 },
    ],
  };
}

describe("bounded portable document overview", () => {
  it("returns an empty fixed-size grid without invented bounds", () => {
    const map = DocumentOverview.build([]);

    expect(map.width).toBe(256);
    expect(map.height).toBe(160);
    expect(map.values.length).toBe(40960);
    expect(map.values.some(Boolean)).toBe(false);
    expect(map.bounds).toBeNull();
  });

  it("uses visible clipped ink and translation instead of its uncut source extent", () => {
    const source = stroke(1, 0, 0);

    source.points[1]!.x = 10000;

    const fragment = {
      ...source,
      clip: BoardRegions.rectangle({ x: 0, y: -5 }, { x: 20, y: 10 }),
      translation: { x: 500, y: 100 },
    };

    const map = DocumentOverview.build([fragment]);

    expect(map.bounds!.left).toBeGreaterThan(400);
    expect(map.bounds!.right).toBeLessThan(600);
    expect(map.bounds!.top).toBeGreaterThan(0);
    expect(map.values.some(Boolean)).toBe(true);
  });

  it("keeps remote content represented with a bounded buffer for20k strokes", () => {
    const map = DocumentOverview.build(
      Array.from({ length: 20000 }, (_, i) =>
        stroke(i + 1, i * 1000, Math.floor(i / 10) * 1000),
      ),
    );

    expect(map.bounds!.right).toBeGreaterThan(19000000);
    expect(map.values.byteLength).toBe(40960);
    expect(map.values.some(Boolean)).toBe(true);
  });
});
