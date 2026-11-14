import { BoardLimits } from "~/entities/board";
import { describe, expect, it } from "vitest";
import { DocumentCodec } from "./document-codec";
import { type Point, type Stroke, BoardConstants } from "~/entities/board";
import { BoardGeometry } from "~/entities/board";
import { BoardStabilization } from "~/entities/board";

function fixture() {
  const document = {
    ...DocumentCodec.emptyDocument(),
    schemaVersion: 3 as const,
  };

  document.strokes = [
    {
      id: 7,
      color: BoardConstants.INK,
      width: 0.7,
      stabilization: { strength: 65, captureZoom: 2 },
      points: [
        { x: 0, y: 0, pressure: 0, time: 0 },
        { x: 1, y: 2, pressure: 1, time: 8 },
        { x: 3, y: 1, pressure: 0.5, time: 16 },
      ],
    },
  ];

  document.viewport = { zoom: 4, x: -50, y: 75 };
  document.background = "grid";

  return document;
}

describe("versioned document codec", () => {
  it.each(["numeric", "legacy", "missing"] as const)(
    "round-trips %s stabilization without changing accepted geometry",
    (profile) => {
      const document = fixture();

      if (profile === "legacy")
        (
          document.strokes[0]! as import("~/entities/board").Stroke
        ).stabilization = { mode: "strong", captureZoom: 2 };

      if (profile === "missing")
        delete (document.strokes[0]! as import("~/entities/board").Stroke)
          .stabilization;

      const result = DocumentCodec.serializeDocument(document);

      expect(result.warning).toBe("");

      const decoded = DocumentCodec.parseDocumentJSON(result.json);

      expect(decoded).toEqual({ ...document, schemaVersion: 5 });
      expect(decoded.strokes[0]).not.toBe(document.strokes[0]);

      const path = (stroke: Stroke) =>
        BoardGeometry.strokeGeometry(
          BoardStabilization.stabilizedPositions(
            stroke.points,
            stroke.stabilization,
          ),
          stroke.width,
        );

      expect(
        path(decoded.strokes[0]! as import("~/entities/board").Stroke),
      ).toEqual(
        path(document.strokes[0]! as import("~/entities/board").Stroke),
      );
    },
  );

  it("reconstructs known fields and strips active pointer metadata from memory snapshots and exports", () => {
    const document = fixture();

    Object.assign(document.strokes[0]!, {
      pointerId: 42,
      diagnostics: { pressure: 1 },
    });

    const clone = DocumentCodec.cloneDocument(document);

    expect(Object.hasOwn(clone.strokes[0]!, "pointerId")).toBe(false);

    const json = DocumentCodec.serializeDocument(document).json;

    expect(json).not.toContain("pointerId");
    expect(json).not.toContain("diagnostics");
    (clone.strokes[0]! as import("~/entities/board").Stroke).points[0]!.x = 50;

    expect(
      (document.strokes[0]! as import("~/entities/board").Stroke).points[0]!.x,
    ).toBe(0);
  });

  it.each([
    { format: "other" },
    { schemaVersion: 4 },
    { background: "neon" },
    { viewport: { zoom: 0, x: 0, y: 0 } },
    { viewport: { zoom: 1, x: 1e9 + 1, y: 0 } },
    { tools: { width: 0.4, stabilization: 65 } },
    { tools: { width: 3, stabilization: NaN } },
  ])("rejects unsupported root data %j", (replacement) => {
    expect(() =>
      DocumentCodec.decodeDocument({ ...fixture(), ...replacement }),
    ).toThrow();
  });

  it.each([
    { x: NaN },
    { y: Infinity },
    { x: 1e9 + 1 },
    { time: -1 },
    { pressure: -0.1 },
    { pressure: 1.1 },
  ])("rejects invalid raw samples %j", (replacement) => {
    const document = fixture();

    Object.assign(
      (document.strokes[0]! as import("~/entities/board").Stroke).points[0]!,
      replacement,
    );

    expect(() => DocumentCodec.decodeDocument(document)).toThrow();
  });

  it("rejects duplicate, noninteger and near-overflow stroke IDs with reserved input headroom", () => {
    const document = fixture();

    document.strokes.push(DocumentCodec.cloneDocument(document).strokes[0]!);
    expect(() => DocumentCodec.decodeDocument(document)).toThrow();

    for (const id of [0, -1, 1.5, Number.MAX_SAFE_INTEGER - 1]) {
      document.strokes = [{ ...document.strokes[0]!, id }];
      expect(() => DocumentCodec.decodeDocument(document)).toThrow();
    }

    document.strokes[0]!.id = BoardLimits.MAX_STROKE_ID;

    expect(DocumentCodec.decodeDocument(document).strokes[0]?.id).toBe(
      BoardLimits.MAX_STROKE_ID,
    );

    expect(Number.isSafeInteger(BoardLimits.MAX_STROKE_ID + 1000000)).toBe(
      true,
    );
  });

  it("rejects ambiguous/out-of-range profiles and empty/sparse arrays from IndexedDB", () => {
    const document = fixture();
    const stroke = document.strokes[0]!;

    for (const stabilization of [
      { strength: 65, mode: "light", captureZoom: 1 },
      { strength: 101, captureZoom: 1 },
      { mode: "other", captureZoom: 1 },
      { mode: "light", captureZoom: 9 },
    ]) {
      expect(() =>
        DocumentCodec.decodeDocument({
          ...document,
          strokes: [{ ...stroke, stabilization }],
        }),
      ).toThrow();
    }

    expect(() =>
      DocumentCodec.decodeDocument({
        ...document,
        strokes: [{ ...stroke, points: [] }],
      }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument({
        ...document,
        strokes: new Array<Stroke>(1),
      }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument({
        ...document,
        strokes: [{ ...stroke, points: new Array<Point>(1) }],
      }),
    ).toThrow();
  });

  it("rejects prototype keys/inherited records instead of assigning untrusted fields", () => {
    const document = fixture();

    for (const key of ["__proto__", "constructor", "prototype"]) {
      const payload = JSON.parse(JSON.stringify(document)) as Record<
        string,
        unknown
      >;

      Object.defineProperty(payload, key, {
        value: { polluted: true },
        enumerable: true,
      });

      expect(() => DocumentCodec.decodeDocument(payload)).toThrow();
    }

    expect(() =>
      DocumentCodec.decodeDocument(Object.create(document) as unknown),
    ).toThrow();

    expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
  });

  it("enforces count and byte boundaries without silently truncating the source", () => {
    const document = fixture();

    expect(() =>
      DocumentCodec.decodeDocument(document, {
        ...DocumentCodec.DOCUMENT_LIMITS,
        strokes: 0,
      }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument(document, {
        ...DocumentCodec.DOCUMENT_LIMITS,
        points: 2,
      }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument(document, {
        ...DocumentCodec.DOCUMENT_LIMITS,
        pointsPerStroke: 2,
      }),
    ).toThrow();

    expect(() =>
      DocumentCodec.decodeDocument(document, {
        ...DocumentCodec.DOCUMENT_LIMITS,
        bytes: 10,
      }),
    ).toThrow();

    expect(
      (document.strokes[0] as import("~/entities/board").Stroke)?.points,
    ).toHaveLength(3);
  });

  it("exports all memory with an explicit unsupported-round-trip warning when outside format limits", () => {
    const document = fixture();

    (document.strokes[0]! as import("~/entities/board").Stroke).points[0]!.x =
      1e9 + 1;

    const exported = DocumentCodec.serializeDocument(document);

    expect(exported.warning).toContain("Обратный импорт");

    const raw = JSON.parse(exported.json) as { items: Stroke[] };

    expect(
      (raw.items[0] as import("~/entities/board").Stroke)?.points,
    ).toHaveLength(3);

    expect(
      (raw.items[0] as import("~/entities/board").Stroke)?.points[0]?.x,
    ).toBe(1e9 + 1);

    expect(() => DocumentCodec.parseDocumentJSON(exported.json)).toThrow();
  });
});

describe("raw backup JSON compatibility", () => {
  it("downloads valid documents and JSON-compatible corrupt records without rewriting their values", () => {
    const document = fixture();

    expect(JSON.parse(DocumentCodec.serializeRawBackup(document))).toEqual(
      document,
    );

    const raw = {
      format: "foreign",
      values: [null, true, 4.5, "text", { nested: "value" }],
    };

    expect(JSON.parse(DocumentCodec.serializeRawBackup(raw))).toEqual(raw);

    const nullPrototype = Object.assign(
      Object.create(null) as Record<string, unknown>,
      { value: 12 },
    );

    expect(JSON.parse(DocumentCodec.serializeRawBackup(nullPrototype))).toEqual(
      { value: 12 },
    );
  });

  it.each([
    ["undefined", undefined],
    ["NaN", NaN],
    ["infinity", Infinity],
    ["bigint", 1n],
    ["Map", new Map([["key", "value"]])],
    ["Set", new Set([1])],
    ["Date", new Date(0)],
    ["sparse array", new Array<unknown>(1)],
    ["undefined property", { missing: undefined }],
    ["undefined array entry", [undefined]],
    ["symbol", Symbol("value")],
  ])(
    "refuses lossy %s rather than producing an empty or partial JSON copy",
    (_label, raw) => {
      expect(() => DocumentCodec.serializeRawBackup(raw)).toThrow(
        "без потери данных",
      );
    },
  );

  it("refuses cycles/aliases and JSON-dropped own data while leaving the original raw graph intact", () => {
    const cycle: Record<string, unknown> = { value: 1 };

    cycle.self = cycle;
    expect(() => DocumentCodec.serializeRawBackup(cycle)).toThrow();
    expect(cycle.self).toBe(cycle);

    const alias = { value: 1 };

    expect(() =>
      DocumentCodec.serializeRawBackup({ a: alias, b: alias }),
    ).toThrow();

    const array = [1, 2];

    Object.defineProperty(array, "extra", { value: "keep", enumerable: true });
    expect(() => DocumentCodec.serializeRawBackup(array)).toThrow();

    const hidden = {};

    Object.defineProperty(hidden, "value", { value: 7, enumerable: false });
    expect(() => DocumentCodec.serializeRawBackup(hidden)).toThrow();
  });

  it("does not invoke getters or toJSON while deciding whether a raw copy is safe", () => {
    let calls = 0;

    const getter = Object.defineProperty({}, "value", {
      enumerable: true,

      get: () => {
        calls++;

        return 1;
      },
    });

    expect(() => DocumentCodec.serializeRawBackup(getter)).toThrow();

    expect(() =>
      DocumentCodec.serializeRawBackup({
        toJSON: () => {
          calls++;

          return {};
        },
      }),
    ).toThrow();

    expect(calls).toBe(0);
  });
});

describe("schema2 fragments and schema1 compatibility", () => {
  const clip = [
    [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  ];

  it("reads schema1 without changing its original accepted source geometry", () => {
    const original = {
      ...fixture(),
      schemaVersion: 1,
      tools: { width: 3, stabilization: 65 },
    };

    expect(DocumentCodec.decodeDocument(original)).toEqual(original);
  });

  it("round-trips shared sources as independent JSON trees with masks and translations", () => {
    const document = fixture(),
      original = document.strokes[0]!;

    document.strokes = [
      {
        ...original,
        source: "source1",
        clip: clip as Stroke["clip"],
        translation: { x: 0.25, y: -2 },
      },
      { ...original, id: 8, source: "source1", clip: clip as Stroke["clip"] },
    ];

    const result = DocumentCodec.parseDocumentJSON(
      DocumentCodec.serializeDocument(document).json,
    );

    expect(result).toEqual({ ...document, schemaVersion: 5 });

    const [a, b] = result.strokes;

    expect((a! as import("~/entities/board").Stroke).points).not.toBe(
      (b! as import("~/entities/board").Stroke).points,
    );

    expect(a!.clip).not.toBe(b!.clip);
    (a! as import("~/entities/board").Stroke).points[0]!.x = 90;
    a!.clip![0]![0]![0]![0] = 90;
    expect((b! as import("~/entities/board").Stroke).points[0]!.x).toBe(0);
    expect(document.strokes[0]!.clip![0]![0]![0]![0]).toBe(0);
  });

  it("rejects missing lineage, inconsistent source geometry, invalid offsets and malformed topology", () => {
    const document = fixture(),
      original = document.strokes[0]!;

    for (const replacement of [
      { clip },
      { source: "../bad" },
      { source: "ok", translation: { x: NaN, y: 0 } },
      {
        source: "ok",
        clip: [
          [
            [
              [0, 0],
              [0, 10],
              [10, 10],
              [10, 0],
              [0, 0],
            ],
          ],
        ],
      },
      {
        source: "ok",
        clip: [
          [
            [
              [0, 0],
              [10, 0],
              [10, 10],
              [0, 10],
            ],
          ],
        ],
      },
    ]) {
      expect(() =>
        DocumentCodec.decodeDocument({
          ...document,
          strokes: [{ ...original, ...replacement }],
        }),
      ).toThrow();
    }

    expect(() =>
      DocumentCodec.decodeDocument({
        ...document,
        strokes: [
          { ...original, source: "same" },
          { ...original, id: 8, width: 4, source: "same" },
        ],
      }),
    ).toThrow("исходная геометрия");
  });

  it("counts repeated source points against document limits", () => {
    const document = fixture(),
      original = document.strokes[0]!;

    document.strokes = [
      { ...original, source: "source" },
      { ...original, id: 8, source: "source" },
    ];

    expect(() =>
      DocumentCodec.decodeDocument(document, {
        ...DocumentCodec.DOCUMENT_LIMITS,
        points: 5,
      }),
    ).toThrow("общий предел");
  });

  it("rejects mask and document vertex limits without truncating masks", () => {
    const document = fixture(),
      original = document.strokes[0]!;

    const ring = Array.from({ length: 8192 }, (_, i) => [
      Math.cos((i * Math.PI) / 4096) * 10,
      Math.sin((i * Math.PI) / 4096) * 10,
    ]);

    ring.push([...ring[0]!]);

    expect(() =>
      DocumentCodec.decodeDocument({
        ...document,
        strokes: [{ ...original, source: "source", clip: [[ring]] }],
      }),
    ).toThrow("8192");

    expect(ring).toHaveLength(8193);

    // Rectangular masks are normalized; many items still count every repeated vertex.
    const strokes = Array.from({ length: 20000 }, (_, i) => ({
      ...original,
      id: i + 1,
      source: "source",
      clip: [
        [
          ...clip[0]!,
          [
            [2, 2],
            [2, 4],
            [4, 4],
            [4, 2],
            [2, 2],
          ],
        ],
      ],
    }));

    expect(() =>
      DocumentCodec.decodeDocument({ ...document, strokes }),
    ).toThrow("100000");
  });
});

describe("schema3 view metadata", () => {
  it.each([1, 2] as const)(
    "loads legacy%s with safe defaults without inventing a writing view",
    (version) => {
      const legacy = { ...fixture(), schemaVersion: version };

      delete legacy.backgroundSettings;
      delete legacy.lastWritingView;

      const result = DocumentCodec.decodeDocument(legacy);

      expect(result.backgroundSettings).toEqual({ contrast: 45, spacing: 24 });
      expect(result.lastWritingView).toBeNull();
      expect(result.strokes).toEqual(legacy.strokes);
    },
  );

  it("round-trips detached settings and a world-centred writing view", () => {
    const source = {
      ...fixture(),
      backgroundSettings: { contrast: 73, spacing: 32 },
      lastWritingView: { center: { x: -4e9, y: 500 }, zoom: 0.25 },
    };

    const result = DocumentCodec.parseDocumentJSON(
      DocumentCodec.serializeDocument(source).json,
    );

    expect(result).toEqual({ ...source, schemaVersion: 5 });
    expect(result.backgroundSettings).not.toBe(source.backgroundSettings);

    expect(result.lastWritingView!.center).not.toBe(
      source.lastWritingView.center,
    );
  });

  it.each([
    { backgroundSettings: undefined },
    { lastWritingView: undefined },
    { backgroundSettings: { contrast: NaN, spacing: 24 } },
    { backgroundSettings: { contrast: 101, spacing: 24 } },
    { backgroundSettings: { contrast: 50.5, spacing: 24 } },
    { backgroundSettings: { contrast: 50, spacing: 13 } },
    { backgroundSettings: { contrast: 50, spacing: 66 } },
    { lastWritingView: { center: { x: Infinity, y: 0 }, zoom: 1 } },
    { lastWritingView: { center: { x: 1e10 + 1, y: 0 }, zoom: 1 } },
    { lastWritingView: { center: { x: 0, y: 0 }, zoom: 0 } },
  ])("rejects malformed v3 metadata %j", (fields) =>
    expect(() =>
      DocumentCodec.decodeDocument({ ...fixture(), ...fields }),
    ).toThrow(),
  );
});
