import { describe, expect, it, vi } from "vitest";
import { StrokeHitTester } from "./hit-test";
import { type Position, type Stroke, BoardConstants } from "./types";
import { BoardStabilization } from "./stabilization";
function stroke(points: Position[], width = 2): Stroke {
  return {
    id: 1,
    color: BoardConstants.INK,
    width,
    points: points.map((point, i) => ({
      ...point,
      pressure: 0.5,
      time: i * 10,
    })),
  };
}
const p = (x: number, y: number): Position => ({ x, y });
describe("rendered stroke hit testing", () => {
  it.each([0.25, 1, 4, 8])(
    "keeps an eight CSS pixel target plus rendered half-width at zoom %s",
    (zoom) => {
      const tester = new StrokeHitTester(zoom);
      for (const ink of [stroke([p(0, 0)]), stroke([p(-100, 0), p(100, 0)])]) {
        const radius = 8 / zoom + ink.width / 2;
        expect(tester.hits(ink, p(0, radius - 0.01), p(0, radius - 0.01))).toBe(
          true,
        );
        expect(tester.hits(ink, p(0, radius + 0.01), p(0, radius + 0.01))).toBe(
          false,
        );
      }
    },
  );
  it("covers round endpoints, zero-length sweeps, sparse crossing sweeps and misses", () => {
    const tester = new StrokeHitTester(1);
    const ink = stroke([p(0, -100), p(0, 100)]);
    expect(tester.hits(ink, p(-100, 0), p(100, 0))).toBe(true);
    expect(tester.hits(ink, p(-100, 110), p(100, 110))).toBe(false);
    expect(tester.hits(ink, p(0, 108.9), p(0, 108.9))).toBe(true);
    expect(tester.hits(stroke([]), p(0, 0), p(0, 0))).toBe(false);
    expect(tester.hits(stroke([p(1, 1), p(1, 1)]), p(1, 1), p(1, 1))).toBe(
      true,
    );
  });
  it("tests the quadratic curve rather than raw control vertices or their polygon", () => {
    const tester = new StrokeHitTester(8);
    const ink = stroke([p(0, 0), p(100, 100), p(200, 0)], 0.5);
    // First rendered quadratic: (0,0), control (100,100), end (150,50).
    expect(tester.hits(ink, p(87.5, 62.5), p(87.5, 62.5))).toBe(true);
    expect(tester.hits(ink, p(100, 100), p(100, 100))).toBe(false);
    expect(tester.hits(ink, p(75, 75), p(75, 75))).toBe(false);
    expect(tester.hits(ink, p(87.5, 65), p(87.5, 65))).toBe(false);
  });
  it("retains collinear backtracking beyond a quadratic chord", () => {
    const tester = new StrokeHitTester(8);
    const ink = stroke([p(0, 0), p(100, 0), p(-100, 0)], 0.5);
    expect(tester.hits(ink, p(50, 0), p(50, 0))).toBe(true);
    expect(tester.hits(ink, p(53, 0), p(53, 0))).toBe(false);
  });
  it("follows stored stabilization at capture zoom without changing the source", () => {
    const ink = stroke(
      [p(0, 0), p(10, 40), p(20, -30), p(30, 40), p(40, 0)],
      0.5,
    );
    ink.stabilization = { strength: 100, captureZoom: 0.25 };
    const before = structuredClone(ink);
    const positions = BoardStabilization.stabilizedPositions(
      ink.points,
      ink.stabilization,
    );
    const a = positions[0]!;
    const b = positions[1]!;
    const c = positions[2]!;
    const end = p((b.x + c.x) / 2, (b.y + c.y) / 2);
    const onCurve = p(
      a.x / 4 + b.x / 2 + end.x / 4,
      a.y / 4 + b.y / 2 + end.y / 4,
    );
    const tester = new StrokeHitTester(8);
    expect(tester.hits(ink, onCurve, onCurve)).toBe(true);
    expect(tester.hits(ink, p(10, 40), p(10, 40))).toBe(false);
    expect(ink).toEqual(before);
  });
  it("caches per gesture by reference and rejects distant bounds before deriving geometry", () => {
    const tester = new StrokeHitTester(1);
    const ink = stroke([p(0, 0), p(100, 0)]);
    const profile = vi.fn(() => undefined);
    Object.defineProperty(ink, "stabilization", { get: profile });
    expect(tester.hits(ink, p(1000, 1000), p(2000, 1000))).toBe(false);
    const boundCalls = profile.mock.calls.length;
    tester.hits(ink, p(1000, 1000), p(2000, 1000));
    expect(profile).toHaveBeenCalledTimes(boundCalls);
    tester.hits(ink, p(50, 0), p(50, 0));
    const geometryCalls = profile.mock.calls.length;
    expect(geometryCalls).toBeGreaterThan(boundCalls);
    tester.hits(ink, p(50, 0), p(50, 0));
    expect(profile).toHaveBeenCalledTimes(geometryCalls);
    expect(tester.hits(stroke([p(1000, 1000)]), p(50, 0), p(50, 0))).toBe(
      false,
    );
  });
});
describe("large valid curve work bounds", () => {
  it("prunes a distant miss within the control hull instead of eagerly flattening the entire curve", () => {
    const tester = new StrokeHitTester(8);
    const ink = stroke([p(0, 0), p(1e9, 1e9), p(-1e9, -1e9)], 0.5);
    const hypot = vi.spyOn(Math, "hypot");
    try {
      expect(tester.hits(ink, p(0, 100), p(0, 100))).toBe(false);
      expect(hypot.mock.calls.length).toBeLessThan(100);
    } finally {
      hypot.mockRestore();
    }
  });
  it("short-circuits a giant curve hit while preserving its backtracking reach", () => {
    const tester = new StrokeHitTester(8);
    const ink = stroke([p(0, 0), p(1e9, 0), p(-1e9, 0)], 0.5);
    const hypot = vi.spyOn(Math, "hypot");
    try {
      expect(tester.hits(ink, p(5e8, 0), p(5e8, 0))).toBe(true);
      expect(hypot.mock.calls.length).toBeLessThan(100);
      expect(tester.hits(ink, p(5e8 + 3, 0), p(5e8 + 3, 0))).toBe(false);
    } finally {
      hypot.mockRestore();
    }
  });
});
describe("fragment eraser broad phase", () => {
  it("rejects distant translated and clipped fragments before building the exact sweep", () => {
    const tester = new StrokeHitTester(1);
    const points = Array.from({ length: 10000 }, (_, i) =>
      p(10000 + i, Math.sin(i)),
    );
    const fragment = {
      ...stroke(points),
      source: "far",
      translation: { x: 100, y: 100 },
      clip: [
        [
          [
            [10000, -10],
            [20000, -10],
            [20000, 10],
            [10000, 10],
            [10000, -10],
          ],
        ],
      ] as import("./types").ClipMask,
    };
    const before = performance.now();
    for (let i = 0; i < 100; i++)
      expect(tester.hits(fragment, p(0, 0), p(5, 5))).toBe(false);
    expect(performance.now() - before).toBeLessThan(100);
    expect(
      tester.hits(
        {
          ...stroke([p(0, 0), p(100, 0)]),
          source: "line",
          translation: { x: 100, y: 100 },
        },
        p(150, 100),
        p(150, 100),
      ),
    ).toBe(true);
  });
});
