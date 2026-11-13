import { describe, it, expect } from "vitest";
import { DocumentCodec } from "./document-codec";
import type { ImageItem, Stroke } from "~/entities/board";
import { BoardConstants } from "~/entities/board";

const asset = {
  id: "image",
  mime: "image/png" as const,
  width: 1,
  height: 1,
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=",
};

const image: ImageItem = {
  kind: "image",
  id: 2,
  asset,
  matrix: [2, 0, 0, 3, 40, 50],
};

const ink: Stroke = {
  id: 1,
  width: 3,
  color: BoardConstants.INK,
  points: [{ x: 0, y: 0, pressure: 0.5, time: 0 }],
};

const wire = () =>
  DocumentCodec.encodeDocument({
    ...DocumentCodec.emptyDocument(),
    strokes: [ink, image, { ...image, id: 3 }],
  });

describe("portable schema4 mixed scene", () => {
  it("writes one ordered discriminated collection and deduplicated embedded assets", () => {
    const encoded = wire();

    expect(encoded).not.toHaveProperty("strokes");
    expect(encoded.items.map((i) => i.kind)).toEqual(["ink", "image", "image"]);
    expect(encoded.assets).toHaveLength(1);

    const decoded = DocumentCodec.decodeDocument(encoded);

    expect(decoded.strokes.map((i) => i.id)).toEqual([1, 2, 3]);

    expect((decoded.strokes[1] as ImageItem).asset).toBe(
      (decoded.strokes[2] as ImageItem).asset,
    );

    expect((decoded.strokes[1] as ImageItem).matrix).toEqual(image.matrix);
  });

  it.each([
    { matrix: [0, 0, 0, 0, 0, 0] },
    { matrix: [1, 0, 0, 1, Infinity, 0] },
    { matrix: [1, 0, 0, 1, 0] },
  ])("rejects invalid matrices before mutation %j", ({ matrix }) => {
    const value = wire();

    Object.assign(value.items[1]!, { matrix });
    expect(() => DocumentCodec.decodeDocument(value)).toThrow("matrix");
  });

  it("rejects missing resources and mismatched encoded headers", () => {
    const value = wire();

    value.assets = [];
    expect(() => DocumentCodec.decodeDocument(value)).toThrow("assetId");

    const mismatch = wire();

    mismatch.assets = [{ ...asset, width: 2 }];
    expect(() => DocumentCodec.decodeDocument(mismatch)).toThrow("заголовком");
  });

  it("normalizes legacy translations while retaining original sample order", () => {
    const old = {
      ...DocumentCodec.emptyDocument(),
      schemaVersion: 2,
      strokes: [{ ...ink, source: "source", translation: { x: 10, y: 20 } }],
    };

    const decoded = DocumentCodec.decodeDocument(old),
      encoded = DocumentCodec.encodeDocument(decoded);

    expect(encoded.items[0]!.matrix).toEqual([1, 0, 0, 1, 10, 20]);

    expect(
      (DocumentCodec.decodeDocument(encoded).strokes[0] as Stroke).points,
    ).toEqual(ink.points);
  });
});

it("retains distinct natural image bounds in geometry jobs that carry no encoded payload", () => {
  const a = {
      ...image,
      asset: { ...asset, id: "a", base64: "", width: 100, height: 50 },
    },
    b = {
      ...image,
      id: 3,
      asset: { ...asset, id: "b", base64: "", width: 300, height: 200 },
    };

  const value = DocumentCodec.encodeDocument(
      { ...DocumentCodec.emptyDocument(), strokes: [a, b] },
      true,
    ),
    decoded = DocumentCodec.decodeDocument(value, undefined, true);

  expect(value.assets).toHaveLength(2);

  expect((decoded.strokes[0] as ImageItem).asset).toMatchObject({
    id: "a",
    width: 100,
    height: 50,
  });

  expect((decoded.strokes[1] as ImageItem).asset).toMatchObject({
    id: "b",
    width: 300,
    height: 200,
  });
});
