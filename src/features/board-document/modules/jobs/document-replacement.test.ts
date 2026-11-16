import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BoardDocument,
  DocumentRepository,
} from "../../board-document.types";
import { DocumentCodec } from "../codec";
import { RecordCopies } from "../record-copies";
import { DocumentJobs } from "./document-jobs";
import type { JobWorker } from "./document-jobs.types";
import type { JobRequest, JobResponse } from "./jobs-protocol";

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

async function setup() {
  vi.resetModules();

  const repository = {
    write: vi.fn(async (_document: BoardDocument) => {}),
    replace: vi.fn(async (_previous: unknown, _candidate: BoardDocument) => {}),
    replaceStored: vi.fn(async (_candidate: BoardDocument) => {}),
    close: vi.fn(async () => {}),
  };

  const adapter = await import("../../adapters/indexeddb");

  vi.spyOn(
    adapter.DocumentRepositoryAdapter,
    "openRepository",
  ).mockResolvedValue(repository as unknown as DocumentRepository);

  const requests: JobRequest[] = [];

  const host = {
    onmessage: null as ((event: MessageEvent<JobRequest>) => void) | null,

    postMessage(data: JobResponse) {
      queueMicrotask(() =>
        worker.onmessage?.call(
          worker as Worker,
          { data } as MessageEvent<JobResponse>,
        ),
      );
    },
  };

  const worker: JobWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: vi.fn(),
    postMessage: ((data: JobRequest) => {
      requests.push(data);

      host.onmessage!({
        data: structuredClone(data),
      } as MessageEvent<JobRequest>);
    }) as JobWorker["postMessage"],
  };

  vi.stubGlobal("self", host);
  await import("./jobs-worker");

  const codec = (await import("../codec")).DocumentCodec;

  return {
    codec,
    jobs: new DocumentJobs({ worker: () => worker }),
    requests,
    worker,
    repository,
  };
}

function document(x: number, variant: string): BoardDocument {
  const png =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

  return {
    ...DocumentCodec.emptyDocument(),
    strokes: [
      {
        id: 1,
        width: 3,
        color: "#182230",
        points: [{ x, y: 2, pressure: 1, time: 0 }],
      },
      {
        kind: "image",
        id: 2,
        matrix: [1, 0, 0, 1, 0, 0],
        asset: {
          id: "same-id",
          mime: "image/png",
          width: 1,
          height: 1,
          base64: png.replace("P8/x8", variant),
        },
      },
    ],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("serialized worker replacement", () => {
  it("preserves separate previous/candidate geometry and colliding asset IDs", async () => {
    const h = await setup(),
      previous = document(11, "P8/x8"),
      candidate = document(22, "P8/y8");

    const priorPoints = (
      previous.strokes[0] as import("~/entities/board").Stroke
    ).points;

    await h.jobs.replace(previous, candidate);

    const [savedPrevious, savedCandidate] = h.repository.replace.mock.calls[0]!;

    expect(savedPrevious).toEqual(DocumentCodec.cloneDocument(previous));
    expect(savedCandidate).toEqual(candidate);

    expect(
      (previous.strokes[0] as import("~/entities/board").Stroke).points,
    ).toBe(priorPoints);

    expect(h.repository.replaceStored).not.toHaveBeenCalled();
    await h.jobs.close();
  });

  it("captures membership/scalars immediately and queues replacement behind writes, then drains before close", async () => {
    const h = await setup(),
      saving = deferred(),
      started = deferred(),
      previous = document(11, "P8/x8"),
      candidate = document(22, "P8/y8");

    h.repository.write.mockImplementationOnce(async () => {
      started.resolve();
      await saving.promise;
    });

    const write = h.jobs.write(previous);
    const replace = h.jobs.replace(previous, candidate);

    previous.viewport.x = 1000;
    candidate.viewport.x = 2000;
    candidate.strokes.length = 0;

    const close = h.jobs.close();

    await started.promise;
    expect(h.repository.replace).not.toHaveBeenCalled();
    expect(h.repository.close).not.toHaveBeenCalled();
    saving.resolve();
    await Promise.all([write, replace, close]);

    const [before, after] = h.repository.replace.mock.calls[0]! as [
      BoardDocument,
      BoardDocument,
    ];

    expect(before.viewport.x).toBe(0);
    expect(after.viewport.x).toBe(0);
    expect(after.strokes).toHaveLength(2);
    expect(h.repository.close).toHaveBeenCalledOnce();
    expect(h.worker.terminate).toHaveBeenCalledOnce();
  });

  it("uses a worker-side atomic raw backup when the old document is unloaded", async () => {
    const h = await setup(),
      candidate = DocumentCodec.emptyDocument();

    await h.jobs.replace({ kind: "stored-current" }, candidate);
    expect(h.repository.replace).not.toHaveBeenCalled();
    expect(h.repository.replaceStored).toHaveBeenCalledWith(candidate);

    expect(
      h.requests.filter((request) => request.type === "start"),
    ).toMatchObject([{ previousStored: true }]);

    await h.jobs.close();
  });

  it("keeps public replacement strict while the prepared persistence port skips repeated decoding", async () => {
    const h = await setup(),
      candidate = DocumentCodec.emptyDocument();

    const decode = vi.spyOn(h.codec, "decodeDocument");

    await h.jobs.replaceValidated(DocumentCodec.emptyDocument(), candidate);
    expect(decode).not.toHaveBeenCalled();
    candidate.tools.width = 100;

    await expect(
      h.jobs.replace(DocumentCodec.emptyDocument(), candidate),
    ).rejects.toThrow();

    expect(decode).toHaveBeenCalled();
    expect(h.repository.replace).toHaveBeenCalledOnce();
    await h.jobs.close();
  });

  it("rejects an aborted atomic replacement and still closes its worker repository", async () => {
    const h = await setup();

    h.repository.replace.mockRejectedValueOnce(
      new Error("transaction aborted"),
    );

    await expect(
      h.jobs.replace(
        DocumentCodec.emptyDocument(),
        DocumentCodec.emptyDocument(),
      ),
    ).rejects.toThrow("transaction aborted");

    expect(h.worker.terminate).toHaveBeenCalledOnce();
    await h.jobs.close();
  });
});

it("publishes the exact runtime previous-copy Blob only after durable replacement completes", async () => {
  const h = await setup(),
    previous = document(11, "P8/x8"),
    candidate = document(22, "P8/y8");

  previous.strokes = previous.strokes.slice(0, 1);

  const started = deferred(),
    complete = deferred();

  h.repository.replace.mockImplementationOnce(async () => {
    started.resolve();
    await complete.promise;
  });

  let settled = false;

  const replacing = h.jobs
    .replaceValidated(previous, candidate)
    .then((record) => {
      settled = true;

      return record;
    });

  await started.promise;
  expect(settled).toBe(false);
  complete.resolve();

  const record = await replacing;

  expect(record?.exists).toBe(true);
  expect(record?.value).toEqual({ schemaVersion: 5 });

  expect(await RecordCopies.read(record!.value)!.text()).toBe(
    DocumentCodec.serializeRawBackup(DocumentCodec.cloneDocument(previous)),
  );

  await h.jobs.close();
});

it("detaches shared fragment sources in the worker before serializing the exact runtime recovery copy", async () => {
  const h = await setup(),
    previous = DocumentCodec.emptyDocument();

  const points = [{ x: 3, y: 4, pressure: 0.5, time: 0 }];

  previous.strokes = [
    {
      id: 1,
      source: "shared",
      width: 3,
      color: "#182230",
      points,
      translation: { x: 1, y: 0 },
    },
    {
      id: 2,
      source: "shared",
      width: 3,
      color: "#182230",
      points,
      translation: { x: 2, y: 0 },
    },
  ];

  const record = await h.jobs.replaceValidated(
    previous,
    DocumentCodec.emptyDocument(),
  );

  const text = await RecordCopies.read(record!.value)!.text();

  expect(text).toBe(
    DocumentCodec.serializeRawBackup(DocumentCodec.cloneDocument(previous)),
  );

  expect(JSON.parse(text)).toHaveProperty("strokes.1.points.0.x", 3);

  expect(
    (previous.strokes[0] as import("~/entities/board").Stroke).points,
  ).toBe(points);

  await h.jobs.close();
});

it("normalizes completed pointer metadata once before both atomic backup and recovery serialization", async () => {
  const h = await setup(),
    previous = DocumentCodec.emptyDocument();

  const completed = {
    id: 1,
    color: "#182230" as const,
    width: 3,
    pointerId: 1,
    pointerType: "pen",
    transientCapture: true,
    points: [
      { x: 1, y: 2, pressure: 0.25, time: 10 },
      { x: 3, y: 4, pressure: 0.75, time: 20 },
    ],
    style: {
      instrument: "pressure" as const,
      opacity: 1,
      pressureStrength: 62,
    },
    stabilization: { strength: 65, captureZoom: 1 },
    source: "completed_1",
    translation: { x: 5, y: 6 },
  };

  previous.strokes.push(completed);

  const clone = vi.spyOn(h.codec, "cloneDocument");

  const copy = await h.jobs.replaceValidated(
    previous,
    DocumentCodec.emptyDocument(),
  );

  const [backup] = h.repository.replace.mock.calls[0]! as [
    BoardDocument,
    BoardDocument,
  ];

  const expected = {
    id: 1,
    color: "#182230",
    width: 3,
    points: completed.points,
    style: completed.style,
    stabilization: completed.stabilization,
    source: "completed_1",
    translation: completed.translation,
  };

  expect(backup.strokes).toEqual([expected]);

  const encoded = DocumentCodec.encodeDocument(backup);

  expect(encoded.items[0]).not.toHaveProperty("pointerId");
  expect(encoded.items[0]).not.toHaveProperty("pointerType");
  expect(encoded.items[0]).not.toHaveProperty("transientCapture");

  expect(
    JSON.parse(await RecordCopies.read(copy!.value)!.text()).strokes,
  ).toEqual([expected]);

  expect(clone).toHaveBeenCalledOnce();
  expect(completed.pointerId).toBe(1);
  expect(completed.transientCapture).toBe(true);
  await h.jobs.close();
});
