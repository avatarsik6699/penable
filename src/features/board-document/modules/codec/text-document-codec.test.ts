import { describe, expect, it } from "vitest";
import { BoardRegions, type TextItem } from "~/entities/board";
import { DocumentCodec } from "./document-codec";
import { FragmentCodec } from "../fragments";

const text: TextItem = {
  kind: "text",
  id: 2,
  text: " a💡 b\n\nПеро\n",
  width: 120,
  lines: [0, 4, 7, 8, 13],
  matrix: [1.5, 0, 0.25, 2, -11, 17],
};

function document(
  strokes: Parameters<typeof DocumentCodec.encodeDocument>[0]["strokes"],
) {
  return { ...DocumentCodec.emptyDocument(), strokes };
}

describe("editable text document", () => {
  it("preserves line starts, Unicode, paragraph breaks, order and affine placement across JSON and fragments", () => {
    const ink = {
      id: 1,
      width: 2,
      color: "#182230" as const,
      points: [{ x: 5, y: 8, pressure: 0.5, time: 1 }],
    };

    const source = document([ink, text]);
    const encoded = DocumentCodec.serializeDocument(source);
    const loaded = DocumentCodec.parseDocumentJSON(encoded.json);

    expect(encoded.warning).toBe("");
    expect(loaded.schemaVersion).toBe(6);
    expect(loaded.strokes.map((item) => item.id)).toEqual([1, 2]);
    expect(loaded.strokes[1]).toEqual(text);

    expect(DocumentCodec.documentStats(loaded)).toEqual({
      strokes: 2,
      points: 1,
    });

    const region = BoardRegions.rectangle({ x: -15, y: 0 }, { x: 300, y: 400 });
    const fragment = FragmentCodec.serialize({ strokes: [text], region });

    expect(JSON.parse(fragment)).toMatchObject({
      format: "penable-fragment",
      schemaVersion: 1,
      document: { schemaVersion: 6 },
    });

    expect(FragmentCodec.parse(fragment)).toEqual({ strokes: [text], region });

    expect(
      DocumentCodec.encodeDocument({ ...loaded, strokes: [ink] }).schemaVersion,
    ).toBe(5);
  });

  it("rejects text under schema5 and schema6 without text objects", () => {
    const encoded = DocumentCodec.encodeDocument(document([text]));

    expect(() =>
      DocumentCodec.decodeDocument({ ...encoded, schemaVersion: 5 }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument({ ...encoded, items: [] }),
    ).toThrow();
  });

  it.each([
    { text: "" },
    { text: "a".repeat(8001) },
    { width: 0 },
    { width: 601 },
    { lines: [0, 3, 7, 8, 13] }, // Between the two UTF-16 code units of the emoji.
    { lines: [0, 4, 8, 13] },
    { lines: [0, 4, 4, 7, 8, 13] },
    { lines: Object.assign(new Array<number>(5), { 0: 0, 2: 7, 3: 8, 4: 13 }) },
    {
      lines: Array.from({ length: 257 }, (_, index) => index),
      text: "a".repeat(300),
    },
    { clip: [] },
    { translation: { x: 1, y: 2 } },
  ])(
    "rejects malformed text metadata in strict and geometry-only modes %#",
    (fields) => {
      const encoded = DocumentCodec.encodeDocument(document([text]));

      const malformed = {
        ...encoded,
        items: [{ ...encoded.items[0], ...fields }],
      };

      expect(() => DocumentCodec.decodeDocument(malformed)).toThrow();

      expect(() =>
        DocumentCodec.decodeDocument(malformed, undefined, true),
      ).toThrow();
    },
  );

  it("measures the aggregate limit in UTF-8 bytes", () => {
    const strokes = Array.from({ length: 65 }, (_, id): TextItem => ({
      ...text,
      id: id + 1,
      text: "💡".repeat(4000),
      lines: [0],
    }));

    strokes.push({
      ...text,
      id: 66,
      text: "💡".repeat(2144),
      lines: [0],
    });

    const encoded = DocumentCodec.encodeDocument(document(strokes));

    expect(DocumentCodec.decodeDocument(encoded).strokes).toHaveLength(66);

    strokes.push({ ...text, id: 67, text: "x", lines: [0] });

    expect(() =>
      DocumentCodec.decodeDocument(
        DocumentCodec.encodeDocument(document(strokes)),
      ),
    ).toThrow();
  });
});
