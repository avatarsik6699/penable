import { describe, expect, it, vi } from "vitest";
import { RecoveryCopy } from "./recovery-copy";
import { RecoveryCopyProjection } from "./recovery-copy.utils";
import { DocumentCodec } from "../codec";

function raw() {
  const matrix = [1, 0, 0, 1, 0, 0];

  return {
    format: "penable-board",
    schemaVersion: 5,
    items: [
      { kind: "ink", matrix, points: [{ x: 1, y: 2, pressure: 0.5, time: 0 }] },
      { kind: "ink", matrix, points: [{ x: 3, y: 4, pressure: 0.5, time: 0 }] },
    ],
    note: { arbitrary: "retained" },
  };
}

function serialize(value: unknown) {
  return RecoveryCopy.serialize({ exists: true, value });
}

function rejected(value: unknown) {
  const result = serialize(value);

  expect(result.blob).toBeUndefined();
  expect(result.error).toBeTruthy();
}

describe("raw recovery matrix projection", () => {
  it.each([4, 5])(
    "exports schema%i aliased matrices verbatim without changing the stored source",
    async (version) => {
      const value = { ...raw(), schemaVersion: version };
      const source = value.items[0]!.matrix;
      const copy = serialize(value);

      expect(copy.error).toBeUndefined();
      expect(await copy.blob!.text()).toBe(JSON.stringify(value));
      expect(value.items[0]!.matrix).toBe(source);
      expect(value.items[1]!.matrix).toBe(source);
      expect(() => DocumentCodec.serializeRawBackup(value)).toThrow();

      const projected = RecoveryCopyProjection.project(value)
        .value as typeof value;

      expect(projected.items[0]!.points).toBe(value.items[0]!.points);
      expect(projected.note).toBe(value.note);
      expect(projected.items[0]!.matrix).not.toBe(projected.items[1]!.matrix);
    },
  );

  it("retains null prototypes and nonwritable descriptors while replacing matrix values safely", async () => {
    const value = raw();

    Object.setPrototypeOf(value, null);

    for (const item of value.items) {
      Object.setPrototypeOf(item, null);

      Object.defineProperty(item, "matrix", {
        value: item.matrix,
        writable: false,
        configurable: false,
        enumerable: true,
      });
    }

    Object.defineProperty(value, "items", {
      value: value.items,
      writable: false,
      configurable: false,
      enumerable: true,
    });

    Object.freeze(value.items);
    Object.freeze(value.items[0]!.matrix);

    const projected = RecoveryCopyProjection.project(value)
      .value as typeof value;

    expect(Object.getPrototypeOf(projected)).toBeNull();
    expect(Object.getPrototypeOf(projected.items[0])).toBeNull();

    expect(Object.getOwnPropertyDescriptor(projected, "items")?.writable).toBe(
      false,
    );

    expect(
      Object.getOwnPropertyDescriptor(projected.items[0]!, "matrix")?.writable,
    ).toBe(false);

    expect(
      Object.getOwnPropertyDescriptor(projected.items, "length")?.writable,
    ).toBe(false);

    expect(await serialize(value).blob!.text()).toBe(JSON.stringify(value));
  });

  it("preserves unsupported values, symbols, nonenumerable fields, holes, cycles and prototypes for rejection", () => {
    const mutations: Array<(value: ReturnType<typeof raw>) => void> = [
      (value) => {
        Object.defineProperty(value, "extra", {
          value: undefined,
          enumerable: true,
        });
      },
      (value) => {
        Object.defineProperty(value, Symbol("raw"), {
          value: 1,
          enumerable: true,
        });
      },
      (value) => {
        Object.defineProperty(value.items[0], "hidden", {
          value: 1,
          enumerable: false,
        });
      },
      (value) => {
        delete value.items[0];
      },
      (value) => {
        delete value.items[0]!.matrix[0];
      },
      (value) => {
        Object.defineProperty(value, "cycle", { value, enumerable: true });
      },
      (value) => {
        Object.setPrototypeOf(value.items[0], { custom: true });
      },
      (value) => {
        Object.defineProperty(value.items[0]!.matrix, Symbol("matrix"), {
          value: 1,
          enumerable: true,
        });
      },
      (value) => {
        Object.defineProperty(value.items, "hidden", {
          value: 1,
          enumerable: false,
        });
      },
    ];

    for (const mutate of mutations) {
      const value = raw();

      mutate(value);
      rejected(value);
    }
  });

  it("never evaluates root, item, point or matrix getters", () => {
    for (const locate of [
      (value: ReturnType<typeof raw>) => [value, "schemaVersion"] as const,
      (value: ReturnType<typeof raw>) => [value, "format"] as const,
      (value: ReturnType<typeof raw>) => [value, "items"] as const,
      (value: ReturnType<typeof raw>) => [value, "note"] as const,
      (value: ReturnType<typeof raw>) => [value.items, "0"] as const,
      (value: ReturnType<typeof raw>) => [value.items[0]!, "matrix"] as const,
      (value: ReturnType<typeof raw>) => [value.items[0]!.matrix, "0"] as const,
      (value: ReturnType<typeof raw>) =>
        [value.items[0]!.points[0]!, "x"] as const,
    ]) {
      const value = raw(),
        getter = vi.fn(() => {
          throw new Error("must not read");
        });

      const [object, key] = locate(value);

      Object.defineProperty(object, key, {
        get: getter,
        enumerable: true,
        configurable: true,
      });

      rejected(value);
      expect(getter).not.toHaveBeenCalled();
    }
  });

  it("keeps unrelated repeated objects and repeated item objects rejected", () => {
    const value = raw();

    value.items[1]!.points = value.items[0]!.points;
    rejected(value);

    const repeated = { matrix: [1, 0, 0, 1, 0, 0] };

    rejected({
      format: "penable-board",
      schemaVersion: 5,
      items: [repeated, repeated],
    });
  });

  it("leaves other schemas and malformed numeric matrices outside the projection", () => {
    for (const version of [1, 2, 3, 6]) {
      const value = { ...raw(), schemaVersion: version };

      expect(RecoveryCopyProjection.project(value).value).toBe(value);
      rejected(value);
    }

    for (const value of [NaN, Infinity, "1"]) {
      const document = raw();

      document.items[0]!.matrix[0] = value as number;
      rejected(document);
    }
  });
});

it.each([false, true])(
  "preserves nested raw container aliases with unknown field first=%s",
  (unknownFirst) => {
    const matrix = [1, 0, 0, 1, 0, 0];
    const image = { kind: "image", id: 1, assetId: "raw", matrix };
    const items = [image];

    for (const referenced of [image, items]) {
      const extra = { nested: { retained: referenced } };

      const value = unknownFirst
        ? { format: "penable-board", schemaVersion: 5, extra, items }
        : { format: "penable-board", schemaVersion: 5, items, extra };

      expect(() => DocumentCodec.serializeRawBackup(value)).toThrow();
      rejected(value);
    }
  },
);

it.each([false, true])(
  "preserves a point extra field aliasing an image with image first=%s",
  (imageFirst) => {
    const matrix = [1, 0, 0, 1, 0, 0];
    const image = { kind: "image", id: 1, assetId: "raw", matrix };

    const ink = {
      kind: "ink",
      id: 2,
      matrix,
      points: [{ x: 1, y: 2, pressure: 0.5, time: 0, extra: image }],
    };

    const value = {
      format: "penable-board",
      schemaVersion: 5,
      items: imageFirst ? [image, ink] : [ink, image],
    };

    expect(() => DocumentCodec.serializeRawBackup(value)).toThrow();
    rejected(value);
  },
);

it("maps only projected containers to original identities and leaves matrix occurrences independent", async () => {
  const value = raw(),
    projection = RecoveryCopyProjection.project(value);

  const result = projection.value as typeof value;

  expect(projection.identities.get(result)).toBe(value);
  expect(projection.identities.get(result.items)).toBe(value.items);
  expect(projection.identities.get(result.items[0]!)).toBe(value.items[0]);
  expect(projection.identities.has(result.items[0]!.matrix)).toBe(false);
  expect(await serialize(value).blob!.text()).toBe(JSON.stringify(value));
});

it("preserves raw JSON forbidden keys without reconstructing the document through its decoder", async () => {
  const value = raw();

  Object.defineProperty(value, "__proto__", {
    value: "raw note",
    enumerable: true,
  });

  Object.defineProperty(value.items[0], "constructor", {
    value: "raw item",
    enumerable: true,
  });

  const copy = serialize(value);

  expect(copy.error).toBeUndefined();
  expect(await copy.blob!.text()).toBe(JSON.stringify(value));
  expect(Object.getPrototypeOf(value)).toBe(Object.prototype);
});
