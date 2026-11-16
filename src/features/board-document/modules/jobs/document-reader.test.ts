import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stroke, ImageItem } from "~/entities/board";
import { DocumentCodec } from "../codec";
import { DocumentReader } from "./document-reader";
import { ImportCandidates } from "../import-candidates";
import type {
  DocumentReadResponse,
  DocumentReadRequest,
} from "./document-reader.types";
import { DocumentReadBuffer } from "./document-read-buffer";

async function stream(input: Blob | DocumentReadRequest) {
  vi.resetModules();

  const messages: DocumentReadResponse[] = [],
    transfers: number[] = [];

  let resolve!: () => void;

  const done = new Promise<void>((yes) => {
    resolve = yes;
  });

  const host = {
    onmessage: null as
      ((event: MessageEvent<DocumentReadRequest>) => void) | null,

    postMessage: (message: DocumentReadResponse, transfer?: Transferable[]) => {
      messages.push(message);

      if ("seq" in message && message.type !== "ack")
        host.onmessage!({
          data: { type: "ack", id: message.id, seq: message.seq },
        } as MessageEvent<DocumentReadRequest>);

      if (message.type === "points-batch")
        transfers.push(transfer?.length ?? 0);

      if (message.type === "finish" || message.type === "error") resolve();
    },
  };

  vi.stubGlobal("self", host);
  await import("./document-reader-worker");

  host.onmessage!({
    data: input instanceof Blob ? { type: "file", blob: input } : input,
  } as MessageEvent<DocumentReadRequest>);

  await done;

  return { messages, transfers };
}

function workers() {
  const instances: Probe[] = [];

  class Probe {
    onmessage: ((event: MessageEvent<DocumentReadResponse>) => void) | null =
      null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      instances.push(this);
    }
  }

  vi.stubGlobal("Worker", Probe);

  return instances;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("document file processing boundary", () => {
  it("strictly validates before returning any data and streams every raw sample in bounded transfers", async () => {
    const ink: Stroke = {
      id: 1,
      width: 3,
      color: "#182230",
      matrix: [1, 0, 0, 1, 20, 30],
      points: Array.from({ length: 10000 }, (_, i) => ({
        x: i,
        y: i % 20,
        pressure: (i % 100) / 100,
        time: i * 2,
      })),
    };

    const image: ImageItem = {
      kind: "image",
      id: 2,
      matrix: [1, 0, 0, 1, 0, 0],
      asset: {
        id: "image",
        mime: "image/png",
        width: 1,
        height: 1,
        base64:
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=",
      },
    };

    const source = { ...DocumentCodec.emptyDocument(), strokes: [ink, image] },
      json = DocumentCodec.serializeDocument(source).json,
      result = await stream(new Blob([json])),
      buffer = new DocumentReadBuffer();

    let decoded;

    for (const message of result.messages) {
      expect(message.type).not.toBe("error");

      if (message.type !== "error") decoded = buffer.accept(message) ?? decoded;

      if (message.type === "points-batch")
        expect(message.values.length).toBeLessThanOrEqual(2048 * 4);

      if (message.type === "strokes")
        expect(message.values.length).toBeLessThanOrEqual(64);
    }

    expect(decoded).toEqual(DocumentCodec.parseDocumentJSON(json));
    expect(result.transfers).toEqual([1, 1, 1, 1, 1]);
  });

  it.each(["{", '{"format":"penable-board","schemaVersion":42}'])(
    "returns no partial candidate for invalid JSON %s",
    async (text) => {
      const result = await stream(new Blob([text]));

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]?.type).toBe("error");
    },
  );

  it("uses the same strict decoder for stored records and detached runtime candidates", async () => {
    const document = DocumentCodec.emptyDocument();

    document.strokes.push({
      id: 1,
      width: 3,
      color: "#182230",
      points: [{ x: 2, y: 3, pressure: 0.7, time: 13 }],
    });

    for (const request of [
      {
        type: "stored" as const,
        value: DocumentCodec.encodeDocument(document),
      },
      { type: "runtime" as const, value: document },
    ]) {
      const result = await stream(request),
        buffer = new DocumentReadBuffer();

      let decoded;

      for (const message of result.messages) {
        expect(message.type).not.toBe("error");

        if (message.type !== "error")
          decoded = buffer.accept(message) ?? decoded;
      }

      expect(decoded).toEqual(
        DocumentCodec.decodeDocument(DocumentCodec.encodeDocument(document)),
      );
    }

    (document.strokes[0] as Stroke).width = 99;

    const invalid = await stream({ type: "runtime", value: document });

    expect(invalid.messages).toHaveLength(1);
    expect(invalid.messages[0]?.type).toBe("error");
  });

  it("terminates on abort and ignores late completion", async () => {
    const instances = workers(),
      controller = new AbortController(),
      reading = DocumentReader.read(new Blob(["document"]), controller.signal);

    controller.abort();
    await expect(reading).rejects.toMatchObject({ name: "AbortError" });
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();

    instances[0]!.onmessage!(
      new MessageEvent("message", { data: { type: "finish", id: 1 } }),
    );

    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
  });

  it("does not start a worker for canceled or oversized files", async () => {
    const instances = workers(),
      controller = new AbortController();

    controller.abort();

    await expect(
      DocumentReader.read(new Blob(), controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });

    await expect(
      DocumentReader.read(
        { size: DocumentCodec.DOCUMENT_LIMITS.bytes + 1 } as Blob,
        new AbortController().signal,
      ),
    ).rejects.toThrow();

    expect(instances).toHaveLength(0);
  });

  it("terminates and rejects on transfer failure without leaving an abort listener", async () => {
    const instances = workers(),
      controller = new AbortController(),
      reading = DocumentReader.read(new Blob(), controller.signal);

    instances[0]!.onmessageerror!();
    await expect(reading).rejects.toThrow();
    controller.abort();
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
  });
});

describe("stored document startup fallback", () => {
  it("strictly decodes stored records when Worker construction is blocked", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("worker blocked");
        }
      },
    );

    const value = DocumentCodec.encodeDocument(DocumentCodec.emptyDocument());

    expect(
      await DocumentReader.decode(value, new AbortController().signal),
    ).toEqual(DocumentCodec.decodeDocument(value));

    await expect(
      DocumentReader.decode(
        { ...value, viewport: { ...value.viewport, zoom: -1 } },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ detail: { code: "invalidDataValue" } });
  });

  it("retains startup after an asynchronous Worker failure and terminates its owned worker", async () => {
    const instances = workers(),
      value = DocumentCodec.encodeDocument(DocumentCodec.emptyDocument()),
      reading = DocumentReader.decode(value, new AbortController().signal);

    instances[0]!.onerror!({ preventDefault() {} } as ErrorEvent);
    expect(await reading).toEqual(DocumentCodec.decodeDocument(value));
    expect(instances[0]!.terminate).toHaveBeenCalledOnce();
  });

  it.each(["before", "during"])(
    "never decodes synchronously after cancellation %s processing",
    async (phase) => {
      const instances = workers(),
        controller = new AbortController(),
        decode = vi.spyOn(DocumentCodec, "decodeDocument"),
        value = DocumentCodec.encodeDocument(DocumentCodec.emptyDocument());

      if (phase === "before") controller.abort();

      const reading = DocumentReader.decode(value, controller.signal);

      if (phase === "during") controller.abort();

      await expect(reading).rejects.toMatchObject({ name: "AbortError" });
      expect(decode).not.toHaveBeenCalled();
      expect(instances).toHaveLength(phase === "during" ? 1 : 0);

      if (instances[0]) expect(instances[0].terminate).toHaveBeenCalledOnce();
    },
  );
});

async function linkedReader() {
  vi.resetModules();

  const instances: Probe[] = [];
  const requests: DocumentReadRequest[] = [];

  const host = {
    onmessage: null as
      ((event: MessageEvent<DocumentReadRequest>) => void) | null,

    postMessage(message: DocumentReadResponse, transfer?: Transferable[]) {
      const data = structuredClone(message, { transfer: transfer ?? [] });

      queueMicrotask(() => {
        const active = instances.at(-1)!;

        if (!active.closed)
          active.onmessage?.(new MessageEvent("message", { data }));
      });
    },
  };

  class Probe {
    onmessage: ((event: MessageEvent<DocumentReadResponse>) => void) | null =
      null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    onmessageerror: (() => void) | null = null;
    closed = false;
    terminate = vi.fn(() => {
      this.closed = true;
    });

    constructor() {
      instances.push(this);
    }

    postMessage(message: DocumentReadRequest) {
      requests.push(message);

      const data = structuredClone(message);

      queueMicrotask(() => {
        if (!this.closed)
          host.onmessage?.(new MessageEvent("message", { data }));
      });
    }
  }

  vi.stubGlobal("self", host);
  vi.stubGlobal("Worker", Probe);
  await import("./document-reader-worker");

  return { requests, worker: () => instances.at(-1)! };
}

describe("owned record and candidate production boundaries", () => {
  it("decodes storage-owned raw pieces through the real strict reader without a whole stored message", async () => {
    const h = await linkedReader(),
      source = DocumentCodec.emptyDocument();

    source.strokes.push({
      id: 1,
      color: "#182230",
      width: 3,
      points: [{ x: 7, y: 8, pressure: 0.2, time: 9 }],
    });

    const stored = DocumentCodec.encodeDocument(source);

    const result = await DocumentReader.decodeOwned(
      stored,
      new AbortController().signal,
    );

    expect(result).toEqual(DocumentCodec.decodeDocument(stored));
    expect(h.requests.some((request) => request.type === "stored")).toBe(false);

    expect(h.requests.some((request) => request.type === "raw-points")).toBe(
      true,
    );

    expect(h.worker().terminate).toHaveBeenCalledOnce();
  });

  it("uses strict owned fallback for unsupported metadata without losing the raw original", async () => {
    const h = await linkedReader(),
      source = {
        ...DocumentCodec.encodeDocument(DocumentCodec.emptyDocument()),
        extra: new Date(),
      };

    const result = await DocumentReader.decodeOwned(
      source,
      new AbortController().signal,
    );

    expect(result).toEqual(DocumentCodec.decodeDocument(source));
    expect(h.requests).toHaveLength(0);
    expect(h.worker().terminate).toHaveBeenCalledOnce();
  });

  it("retains a generic mutable decode snapshot after asynchronous worker failure", async () => {
    const instances = workers(),
      value = DocumentCodec.encodeDocument(DocumentCodec.emptyDocument());

    const reading = DocumentReader.decode(value, new AbortController().signal);

    value.viewport.x = 987;
    instances[0]!.onerror!({ preventDefault() {} } as ErrorEvent);
    expect((await reading).viewport.x).toBe(0);
  });

  it("retains the native synchronous snapshot for generic mutable prepare", async () => {
    await linkedReader();

    const source = DocumentCodec.emptyDocument();

    source.strokes.push({
      id: 1,
      color: "#182230",
      width: 3,
      points: [{ x: 7, y: 8, pressure: 0.2, time: 9 }],
    });

    const reading = DocumentReader.prepare(
      source,
      new AbortController().signal,
    );

    (source.strokes[0] as Stroke).points[0]!.x = 99;
    source.viewport.x = 987;

    const result = await reading;

    expect((result.strokes[0] as Stroke).points[0]!.x).toBe(7);
    expect(result.viewport.x).toBe(0);
  });

  it("returns only a frozen summary capability and revokes it explicitly", async () => {
    const h = await linkedReader();
    const document = DocumentCodec.emptyDocument();

    document.strokes.push({
      id: 1,
      color: "#182230",
      width: 3,
      points: [{ x: 7, y: 8, pressure: 0.2, time: 9 }],
    });

    const candidate = await DocumentReader.readCandidate(
      new Blob([DocumentCodec.serializeDocument(document).json]),
      new AbortController().signal,
    );

    expect(candidate).toEqual({ summary: { strokes: 1, points: 1 } });
    expect(Object.isFrozen(candidate)).toBe(true);
    expect(Object.isFrozen(candidate.summary)).toBe(true);
    expect(ImportCandidates.document(candidate).strokes).toHaveLength(1);
    DocumentReader.disposeCandidate(candidate);
    expect(() => ImportCandidates.document(candidate)).toThrow();
    expect(h.worker().terminate).toHaveBeenCalledOnce();
  });
});
