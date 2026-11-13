import { describe, expect, it } from "vitest";
import { BoardBackground } from "./background";
describe("world-anchored board background", () => {
  it("starts with a 24-world-unit repeat at the world origin", () => {
    expect(BoardBackground.backgroundLayout({ zoom: 1, x: 0, y: 0 })).toEqual({
      worldStep: 24,
      screenStep: 24,
      phaseX: 0,
      phaseY: 0,
    });
  });
  it("normalizes negative and large offsets into a positive repeat phase", () => {
    expect(
      BoardBackground.backgroundLayout({ zoom: 1, x: -1, y: -49 }),
    ).toMatchObject({ phaseX: 23, phaseY: 23 });
    expect(
      BoardBackground.backgroundLayout({ zoom: 1, x: 24000, y: -24000 }),
    ).toMatchObject({ phaseX: 0, phaseY: 0 });
    expect(
      Object.is(
        BoardBackground.backgroundLayout({ zoom: 1, x: -24, y: 0 }).phaseX,
        -0,
      ),
    ).toBe(false);
  });
  it.each([
    [0.125, 96, 12],
    [0.25, 48, 12],
    [0.49, 48, 23.52],
    [0.5, 24, 12],
    [1, 24, 24],
    [8, 24, 192],
  ])(
    "coarsens only by powers of two at zoom %s",
    (zoom, worldStep, screenStep) => {
      const layout = BoardBackground.backgroundLayout({ zoom, x: -7, y: 11 });
      expect(layout.worldStep).toBe(worldStep);
      expect(layout.screenStep).toBeCloseTo(screenStep, 8);
      expect(layout.screenStep).toBeGreaterThanOrEqual(12);
      expect(layout.phaseX).toBeGreaterThanOrEqual(0);
      expect(layout.phaseX).toBeLessThan(layout.screenStep);
    },
  );
  it.each([0.25, 0.75, 2, 4])(
    "keeps every visible lattice point on the transformed world grid at zoom %s",
    (zoom) => {
      const viewport = { zoom, x: -53.25, y: 17.5 };
      const layout = BoardBackground.backgroundLayout(viewport);
      for (const index of [-5, -1, 0, 1, 6]) {
        const screenX = index * layout.worldStep * zoom + viewport.x;
        const screenY = index * layout.worldStep * zoom + viewport.y;
        expect((screenX - layout.phaseX) / layout.screenStep).toBeCloseTo(
          Math.round((screenX - layout.phaseX) / layout.screenStep),
          8,
        );
        expect((screenY - layout.phaseY) / layout.screenStep).toBeCloseTo(
          Math.round((screenY - layout.phaseY) / layout.screenStep),
          8,
        );
      }
    },
  );
});
