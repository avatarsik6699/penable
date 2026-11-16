import { describe, expect, it } from "vitest";
import { CreditWindow } from "./credit-window";
import { OwnedRecordTransfer } from "./owned-record-transfer";
import { OwnedRecordBuffer } from "./owned-record-buffer";
import { DocumentCodec } from "../codec";
import type { OwnedRecordPacket } from "./document-reader.types";

async function transfer(value: unknown) {
  const credit = new CreditWindow(),
    buffer = new OwnedRecordBuffer(),
    packets: OwnedRecordPacket[] = [];

  let result: unknown;

  await OwnedRecordTransfer.send(
    value,
    credit,
    (packet) => {
      packets.push(packet);
      result = buffer.accept(structuredClone(packet)) ?? result;

      if ("seq" in packet) credit.acknowledge(packet.seq);
    },
    async () => {},
  );

  return { result, packets };
}

function raw(version = 5) {
  const document = DocumentCodec.emptyDocument();

  document.strokes.push({
    id: 1,
    width: 3,
    color: "#182230",
    points: [{ x: 1, y: 2, pressure: 0.5, time: 0 }],
  });

  return version >= 4
    ? { ...DocumentCodec.encodeDocument(document), schemaVersion: version }
    : { ...document, schemaVersion: version };
}

describe("owned storage raw transfer", () => {
  it.each([1, 2, 3, 4, 5])(
    "retains schema %i through the unchanged strict decoder",
    async (version) => {
      const source = raw(version);
      const { result, packets } = await transfer(source);

      expect(DocumentCodec.decodeDocument(result)).toEqual(
        DocumentCodec.decodeDocument(source),
      );

      expect(packets[0]).not.toHaveProperty("root.strokes");
      expect(packets[0]).not.toHaveProperty("root.items");
      expect(packets[0]).not.toHaveProperty("root.assets");
    },
  );

  it("packs small sources and metadata without coercing unknown numeric values", async () => {
    const source = raw(1) as {
      strokes: Array<{ points: Array<{ x: unknown }> }>;
    };

    source.strokes[0]!.points[0]!.x = "1";

    const { result } = await transfer(source);

    expect((result as typeof source).strokes[0]!.points[0]!.x).toBe("1");
    expect(() => DocumentCodec.decodeDocument(result)).toThrow();
  });

  it("preserves holes, missing versus undefined fields, forbidden properties and null prototypes", async () => {
    for (const mutate of [
      (source: ReturnType<typeof raw>) => {
        delete (source as { strokes: unknown[] }).strokes[0];
      },
      (source: ReturnType<typeof raw>) => {
        delete (source as { strokes: Array<{ points: unknown[] }> }).strokes[0]!
          .points[0];
      },
      (source: ReturnType<typeof raw>) => {
        delete (source.viewport as Partial<typeof source.viewport>).x;
      },
      (source: ReturnType<typeof raw>) => {
        (source.viewport as { x: unknown }).x = undefined;
      },
      (source: ReturnType<typeof raw>) => {
        Object.defineProperty(source.viewport, "constructor", {
          value: 1,
          enumerable: true,
        });
      },
    ]) {
      const source = raw(1);

      mutate(source);

      const { result } = await transfer(source);

      expect(() => DocumentCodec.decodeDocument(result)).toThrow();
    }

    const source = raw(1);

    Object.setPrototypeOf(source.viewport, null);

    expect(
      DocumentCodec.decodeDocument((await transfer(source)).result),
    ).toEqual(DocumentCodec.decodeDocument(source));
  });

  it("rejects unsupported prototypes, cycles and oversized metadata before native normalization", async () => {
    for (const extra of [new Date(), "x".repeat(65537)]) {
      await expect(transfer({ ...raw(1), extra })).rejects.toThrow(
        "Unsupported",
      );
    }

    const source = { ...raw(1), extra: {} };

    source.extra = source;
    await expect(transfer(source)).rejects.toThrow("Unsupported");
  });

  it("packs a million raw points into 489 point packets and 313 metadata packets", async () => {
    const source = raw(1) as {
      strokes: Array<{
        id: number;
        width: number;
        color: string;
        points: Array<{ x: number; y: number; pressure: number; time: number }>;
      }>;
    };

    source.strokes = Array.from({ length: 20000 }, (_, index) => ({
      id: index + 1,
      width: 3,
      color: "#182230",
      points: Array.from({ length: 50 }, (_, point) => ({
        x: point,
        y: index,
        pressure: 0.5,
        time: 0,
      })),
    }));

    const { result, packets } = await transfer(source);
    const points = packets.filter((packet) => packet.type === "raw-points");

    expect(points).toHaveLength(489);

    expect(
      points.every(
        (packet) => packet.ranges.length <= 64 && packet.values.length <= 2048,
      ),
    ).toBe(true);

    expect(
      packets.filter((packet) => packet.type === "raw-items"),
    ).toHaveLength(313);

    const document = result as typeof source;

    expect(document.strokes[0]!.points).toEqual(source.strokes[0]!.points);

    expect(document.strokes[19999]!.points).toEqual(
      source.strokes[19999]!.points,
    );
  });
});
