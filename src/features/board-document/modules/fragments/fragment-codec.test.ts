import { describe, expect, it } from "vitest";
import {
  BoardConstants,
  BoardRegions,
  BoardTransforms,
  type BoardItem,
} from "~/entities/board";
import { FragmentCodec } from "./fragment-codec";

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

const region = BoardRegions.rectangle({ x: 0, y: 0 }, { x: 200, y: 100 });

const ink: BoardItem = {
  id: 1,
  width: 2,
  color: BoardConstants.INK,
  points: [
    { x: 5, y: 5, pressure: 0.5, time: 0 },
    { x: 20, y: 5, pressure: 0.4, time: 1 },
  ],
  source: "shared",
  clip: BoardRegions.rectangle({ x: 0, y: 0 }, { x: 10, y: 10 }),
  matrix: [2, 0, 0, 1, 5, 5],
};

describe("portable fragment codec", () => {
  it("retains partial masks, whitespace, affine geometry and source lineage", () => {
    const fragment = FragmentCodec.parse(
      FragmentCodec.serialize({ strokes: [ink, { ...ink, id: 2 }], region }),
    );

    expect(fragment.region).toEqual(region);
    expect(fragment.strokes).toEqual([ink, { ...ink, id: 2 }]);
  });

  it("rejects invalid own versions, extra envelope fields and corrupt geometry", () => {
    const envelope = JSON.parse(
      FragmentCodec.serialize({ strokes: [ink], region }),
    );

    expect(() =>
      FragmentCodec.parse(JSON.stringify({ ...envelope, schemaVersion: 2 })),
    ).toThrow();

    expect(() =>
      FragmentCodec.parse(JSON.stringify({ ...envelope, other: true })),
    ).toThrow();

    envelope.document.items[0].matrix = [0, 0, 0, 0, 0, 0];
    expect(() => FragmentCodec.parse(JSON.stringify(envelope))).toThrow();
  });

  it("rejects unnormalized region and embedded image corruption", () => {
    const envelope = JSON.parse(
      FragmentCodec.serialize({ strokes: [ink], region }),
    );

    expect(() =>
      FragmentCodec.parse(
        JSON.stringify({
          ...envelope,
          region: [
            [
              [
                [0, 0],
                [1, 0],
                [0, 1],
                [1, 1],
              ],
            ],
          ],
        }),
      ),
    ).toThrow();

    expect(() =>
      FragmentCodec.serialize({
        strokes: [
          {
            kind: "image",
            id: 3,
            asset: {
              id: "bad",
              mime: "image/png",
              width: 1,
              height: 1,
              base64,
            },
            matrix: BoardTransforms.IDENTITY,
          },
        ],
        region,
      }),
    ).toThrow();
  });
});
