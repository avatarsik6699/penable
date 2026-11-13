import { describe, it, expect } from "vitest";
import { SelectionTransform } from "./selection-transform";
import { BoardRegions } from "../../../regions";
import { BoardTransforms } from "../../../transforms";

const region = BoardRegions.rectangle({ x: 10, y: 20 }, { x: 110, y: 120 });

describe("selection transform contacts", () => {
  it("exposes eight resize handles and one rotation handle at fixed screen distance", () => {
    const transform = new SelectionTransform(),
      handles = transform.handles(region, 2);

    expect(handles).toHaveLength(9);
    expect(handles[8]!.y).toBe(6);
  });

  it("keeps opposite anchor fixed, and derives every preview from pointerdown bounds", () => {
    const transform = new SelectionTransform();

    expect(transform.down(1, { x: 110, y: 120 }, region, 1)).toBe(true);
    transform.move({ x: 210, y: 320 });

    const first = transform.matrix;

    expect(BoardTransforms.point(first, { x: 10, y: 20 })).toEqual({
      x: 10,
      y: 20,
    });

    expect(BoardTransforms.point(first, { x: 110, y: 120 })).toEqual({
      x: 210,
      y: 320,
    });

    transform.move({ x: 160, y: 220 });
    transform.move({ x: 210, y: 320 });
    expect(transform.matrix).toEqual(first);
    transform.cancel();
    expect(transform.pointerId).toBeNull();
  });

  it("preserves proportions with Shift and clamps crossing without mirroring", () => {
    const transform = new SelectionTransform();

    transform.down(1, { x: 110, y: 120 }, region, 1);
    transform.move({ x: 210, y: 120 }, true);
    expect(transform.matrix[0]).toBe(2);
    expect(transform.matrix[3]).toBe(2);
    transform.move({ x: -100, y: -100 });
    expect(transform.matrix[0]).toBeGreaterThan(0);
    expect(transform.matrix[3]).toBeGreaterThan(0);
  });

  it("snaps rotation to fifteen degrees with Shift", () => {
    const transform = new SelectionTransform();

    transform.down(1, { x: 60, y: -8 }, region, 1);
    transform.move({ x: 100, y: -3 }, true);

    const angle =
      (Math.atan2(transform.matrix[1], transform.matrix[0]) * 180) / Math.PI;

    expect(angle / 15).toBeCloseTo(Math.round(angle / 15));
  });
});

it("keeps an off-centre handle press/release a true identity and chooses the nearest handle", () => {
  const transform = new SelectionTransform();

  expect(transform.down(1, { x: 106, y: 117 }, region, 1)).toBe(true);
  transform.move({ x: 106, y: 117 });

  expect(
    transform.matrix.every(
      (value, index) => value === BoardTransforms.IDENTITY[index],
    ),
  ).toBe(true);

  const tiny = BoardRegions.rectangle({ x: 0, y: 0 }, { x: 10, y: 10 });

  transform.cancel();
  transform.down(1, { x: 10, y: 10 }, tiny, 1);
  transform.move({ x: 20, y: 20 });

  expect(BoardTransforms.point(transform.matrix, { x: 0, y: 0 })).toEqual({
    x: 0,
    y: 0,
  });
});
