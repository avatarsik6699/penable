import { describe, expect, it } from "vitest";
import {
  BoardRegions,
  BoardTemplates,
  BoardConstants,
  BoardWriting,
  type Stroke,
  type TemplateItem,
} from "~/entities/board";
import { DocumentCodec } from "./document-codec";
import { FragmentCodec } from "../fragments";

function fixture() {
  const ink: Stroke = {
    id: 1,
    color: "#175cd3",
    width: 24,
    style: { instrument: "highlighter", opacity: 0.3, pressureStrength: 65 },
    points: [{ x: 10, y: 20, pressure: 0.5, time: 0 }],
  };

  const template: TemplateItem = {
    kind: "template",
    id: 2,
    generatorVersion: 1,
    template: BoardTemplates.defaults("circle"),
    matrix: [1, 0, 0, 1, 50, 20],
  };

  return { ...DocumentCodec.emptyDocument(), strokes: [ink, template] };
}

describe("schema5 instruments and templates", () => {
  it("round-trips styles, per-instrument settings and templates as editable data", () => {
    const document = fixture();

    document.tools.writing = {
      ...BoardWriting.defaults(),
      instrument: "highlighter",
    };

    const encoded = DocumentCodec.encodeDocument(document),
      decoded = DocumentCodec.decodeDocument(encoded);

    expect(encoded.schemaVersion).toBe(5);
    expect(decoded).toEqual(document);

    const fragment = {
      strokes: document.strokes,
      region: BoardRegions.rectangle({ x: 0, y: 0 }, { x: 400, y: 400 }),
    };

    expect(FragmentCodec.parse(FragmentCodec.serialize(fragment))).toEqual(
      fragment,
    );
  });

  it("rejects nonpalette colors, invalid styles and invalid template configuration", () => {
    for (const change of [
      { color: "red" },
      { style: { instrument: "pen", opacity: 0.3, pressureStrength: 65 } },
      { style: { instrument: "pressure", opacity: 1, pressureStrength: 101 } },
    ]) {
      const encoded = DocumentCodec.encodeDocument(fixture());

      Object.assign(encoded.items[0]!, change);
      expect(() => DocumentCodec.decodeDocument(encoded)).toThrow();
    }

    const encoded = DocumentCodec.encodeDocument(fixture());

    Object.assign(encoded.items[1]!, { generatorVersion: 2 });
    expect(() => DocumentCodec.decodeDocument(encoded)).toThrow();
  });

  it("does not reinterpret pressure on imported schema4 ink", () => {
    const root = {
      ...DocumentCodec.encodeDocument(fixture()),
      schemaVersion: 4,
      items: [
        {
          kind: "ink",
          id: 1,
          matrix: [1, 0, 0, 1, 0, 0],
          color: BoardConstants.INK,
          width: 3,
          points: [
            { x: 0, y: 0, pressure: 0.1, time: 0 },
            { x: 10, y: 0, pressure: 1, time: 1 },
          ],
        },
      ],
    };

    const decoded = DocumentCodec.decodeDocument(root);

    expect((decoded.strokes[0] as Stroke).style).toBeUndefined();
  });
});
