import { describe, expect, it } from "vitest";
import { BoardTransforms } from "./transforms";
import { BoardRegions } from "../regions";
import { BoardConstants, type Stroke, type ImageItem } from "../board.types";
import { StrokeHitTester } from "../input";

const ink: Stroke = {
  id: 1,
  width: 4,
  color: BoardConstants.INK,
  points: [
    { x: 0, y: 0, pressure: 0.5, time: 0 },
    { x: 100, y: 0, pressure: 0.5, time: 1 },
  ],
};

const image: ImageItem = {
  kind: "image",
  id: 2,
  asset: { id: "image", width: 100, height: 50, mime: "image/png", base64: "" },
  matrix: [1, 0, 0, 1, 0, 0],
};

describe("affine immutable sources", () => {
  it("composes without baking points and inverse maps a world point", () => {
    const rotated = BoardTransforms.apply(
      ink,
      BoardTransforms.around({ x: 0, y: 0 }, 2, 3, 90),
    );

    expect(rotated.kind).not.toBe("image");
    expect((rotated as Stroke).points).toBe(ink.points);

    const p = BoardTransforms.point(BoardTransforms.matrix(rotated), {
      x: 40,
      y: 4,
    });

    expect(p.x).toBeCloseTo(-12);
    expect(p.y).toBeCloseTo(80);

    expect(
      BoardTransforms.point(
        BoardTransforms.inverse(BoardTransforms.matrix(rotated)),
        p,
      ),
    ).toMatchObject({ x: 40, y: 4 });

    expect(ink.matrix).toBeUndefined();
  });

  it("retains translation fast paths and rejects singular transforms atomically", () => {
    const shifted = BoardTransforms.apply(ink, [1, 0, 0, 1, 10, 20]);

    expect(shifted.matrix).toBeUndefined();
    expect(shifted.translation).toEqual({ x: 10, y: 20 });
    expect(() => BoardTransforms.apply(ink, [0, 0, 0, 0, 0, 0])).toThrow();
    expect(ink.points[0]!.x).toBe(0);
  });

  it("inverse clips a rotated nonuniformly scaled ink source and preserves raw geometry", () => {
    const transformed = BoardTransforms.apply(ink, [0, 2, -3, 0, 80, 20]);
    const region = BoardRegions.rectangle({ x: 77, y: 60 }, { x: 83, y: 100 });
    const parts = BoardRegions.selectParts([transformed], region, () => 3);

    expect(parts).toHaveLength(1);
    expect((parts[0]!.selected as Stroke).points).toBe(ink.points);
    expect(parts[0]!.selected.matrix).toBe(transformed.matrix);

    const bounds = BoardRegions.visibleBounds([parts[0]!.selected])!;

    expect(bounds.top).toBeCloseTo(60);
    expect(bounds.bottom).toBeCloseTo(100);
  });

  it("inverse transforms eraser sweep instead of applying a uniform radius approximation", () => {
    const transformed = BoardTransforms.apply(
      ink,
      [2, 0, 0, 10, 0, 100],
    ) as Stroke;

    const tester = new StrokeHitTester(1);

    expect(
      tester.hits(transformed, { x: 100, y: 127 }, { x: 100, y: 127 }),
    ).toBe(true);

    expect(
      tester.hits(transformed, { x: 100, y: 130 }, { x: 100, y: 130 }),
    ).toBe(false);
  });

  it("selects partial images in natural local coordinates and groups only equal full matrices", () => {
    const rotated = { ...image, matrix: [0, 2, -2, 0, 100, 10] as const };

    const parts = BoardRegions.selectParts(
      [rotated],
      BoardRegions.rectangle({ x: 20, y: 30 }, { x: 80, y: 90 }),
      () => 4,
    );

    expect(parts).toHaveLength(1);
    expect(parts[0]!.selected.kind).toBe("image");
    expect((parts[0]!.selected as ImageItem).asset).toBe(image.asset);
    expect(parts[0]!.remainder).not.toBeNull();

    const a = { ...rotated, source: "source" },
      b = {
        ...rotated,
        id: 5,
        source: "source",
        matrix: [0, 3, -2, 0, 100, 10] as const,
      };

    expect(BoardRegions.groupedStrokes([a, b])).toHaveLength(2);
  });
});

it("keeps alpha drawing order when related ink or image fragments straddle another image", () => {
  const a = { ...ink, source: "ink" },
    b = { ...ink, id: 3, source: "ink" },
    middle = { ...image, id: 4 },
    last = { ...image, id: 5, source: "image" };

  expect(BoardRegions.groupedStrokes([a, middle, b])).toEqual([a, middle, b]);

  const first = { ...last, id: 6 };

  expect(BoardRegions.groupedStrokes([first, middle, last])).toEqual([
    first,
    middle,
    last,
  ]);
});
