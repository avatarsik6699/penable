import { describe, expect, it } from "vitest";
import { BoardCoordinates } from "./coordinates";
describe("scene coordinates", () => {
  const sample = {
    pointerId: 1,
    clientX: 42.5,
    clientY: 120.25,
    pressure: 0,
    timeStamp: 12,
  };
  it("subtracts the CSS origin without rounding or bitmap scaling", () => {
    expect(
      BoardCoordinates.toScenePoint(sample, { left: 10.25, top: 20.5 }),
    ).toEqual({
      x: 32.25,
      y: 99.75,
      pressure: 0,
      time: 12,
    });
  });
  it("retains positions outside the sheet for pointer capture", () => {
    expect(
      BoardCoordinates.toScenePoint(sample, { left: 50, top: 140 }),
    ).toMatchObject({ x: -7.5, y: -19.75 });
  });
  it("DPR changes only bitmap resolution, never the stored scene point", () => {
    const point = BoardCoordinates.toScenePoint(sample, { left: 0, top: 0 });
    expect(BoardCoordinates.bitmapSize(300, 200, 1)).toMatchObject({
      width: 300,
      height: 200,
    });
    expect(BoardCoordinates.bitmapSize(300, 200, 2)).toMatchObject({
      width: 600,
      height: 400,
    });
    expect(point).toEqual(
      BoardCoordinates.toScenePoint(sample, { left: 0, top: 0 }),
    );
    expect(point?.x).toBe(42.5);
  });
  it.each([NaN, Infinity, -1, 0])("uses a safe DPR for %s", (value) => {
    expect(BoardCoordinates.validDpr(value)).toBe(1);
  });
  it("rejects non-finite input values and bounds", () => {
    expect(
      BoardCoordinates.toScenePoint(
        { ...sample, pressure: NaN },
        { left: 0, top: 0 },
      ),
    ).toBeNull();
    expect(
      BoardCoordinates.toScenePoint(sample, { left: Infinity, top: 0 }),
    ).toBeNull();
  });
  it("inverts the translated zoomed board using client bounds", () => {
    expect(
      BoardCoordinates.toScenePoint(
        sample,
        { left: 10.5, top: 20.25 },
        { zoom: 2, x: -8, y: 40 },
      ),
    ).toEqual({
      x: 20,
      y: 30,
      pressure: 0,
      time: 12,
    });
  });
});
describe("two-layer raster budget", () => {
  it("accounts for native pinch and bitmap rounding in the real transform ratios", () => {
    const size = BoardCoordinates.bitmapSize(101.25, 80.75, 1.5, 2);
    expect(size.requestedRatio).toBe(3);
    expect(size.width).toBe(304);
    expect(size.height).toBe(242);
    expect(size.scaleX * 101.25).toBeCloseTo(size.width, 10);
    expect(size.scaleY * 80.75).toBeCloseTo(size.height, 10);
    expect(size.capped).toBe(false);
  });
  it.each([
    [3840, 2160, 2, 1],
    [1440, 900, 2, 8],
    [20000, 100, 4, 1],
    [100, 20000, 4, 1],
  ])(
    "caps both layers and sides at %sx%s DPR%s native%s",
    (width, height, dpr, native) => {
      const size = BoardCoordinates.bitmapSize(width, height, dpr, native);
      expect(size.totalPixels).toBeLessThanOrEqual(
        BoardCoordinates.BITMAP_PIXEL_BUDGET,
      );
      expect(size.width).toBeLessThanOrEqual(
        BoardCoordinates.BITMAP_SIDE_LIMIT,
      );
      expect(size.height).toBeLessThanOrEqual(
        BoardCoordinates.BITMAP_SIDE_LIMIT,
      );
      expect(size.capped).toBe(true);
      expect(size.effectiveRatio).toBeLessThan(size.requestedRatio);
    },
  );
  it("normalizes missing/invalid native scale and handles an empty CSS surface", () => {
    expect(BoardCoordinates.bitmapSize(300, 200, 2, 0).requestedRatio).toBe(2);
    expect(BoardCoordinates.bitmapSize(300, 200, 2, NaN).requestedRatio).toBe(
      2,
    );
    expect(BoardCoordinates.bitmapSize(0, 0, 1)).toMatchObject({
      width: 1,
      height: 1,
    });
  });
});
