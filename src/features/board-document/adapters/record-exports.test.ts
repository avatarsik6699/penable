import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentRecordExports } from "./record-exports";
import { RecordCopies } from "../modules/record-copies";
import { DocumentCodec } from "../modules/codec";

afterEach(() => vi.unstubAllGlobals());

describe("immutable raw recovery export", () => {
  it("downloads a captured Blob after worker disposal without starting another worker", async () => {
    const worker = vi.fn(() => {
      throw new Error("worker blocked");
    });

    vi.stubGlobal("Worker", worker);

    const blob = new Blob(['{"exact":true}'], { type: "application/json" });

    const record = RecordCopies.capture({
      exists: true,
      schemaVersion: 1,
      blob,
    });

    expect(
      await DocumentRecordExports.serialize(
        record.value,
        new AbortController().signal,
      ),
    ).toBe(blob);

    expect(worker).not.toHaveBeenCalled();
  });

  it("preserves the serializer rejection of a non-JSON raw snapshot", async () => {
    const record = RecordCopies.capture({
      exists: true,
      error: "not representable",
    });

    await expect(
      DocumentRecordExports.serialize(
        record.value,
        new AbortController().signal,
      ),
    ).rejects.toThrow("not representable");
  });

  it("keeps raw runtime representation and malformed scalar types in the independent emergency fallback", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("worker blocked");
        }
      },
    );

    const document = DocumentCodec.emptyDocument();

    document.strokes.push({
      id: 1,
      width: 3,
      color: "#182230",
      points: [{ x: "raw" as unknown as number, y: 2, pressure: 0.5, time: 0 }],
    });

    const output = await DocumentRecordExports.serialize(
      document,
      new AbortController().signal,
    );

    expect(output).toBe(DocumentCodec.serializeRawBackup(document));

    expect(JSON.parse(output as string)).toHaveProperty(
      "strokes.0.points.0.x",
      "raw",
    );

    expect(JSON.parse(output as string)).not.toHaveProperty("items");
  });
});
