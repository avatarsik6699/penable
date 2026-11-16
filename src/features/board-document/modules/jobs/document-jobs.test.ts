import { describe, expect, it } from "vitest";
import {
  DocumentJobs,
  type JobWorker,
  DocumentWorkload,
} from "./document-jobs";
import { DocumentCodec } from "../codec";
import type { JobRequest, JobResponse, StrokeMetadata } from "./jobs-protocol";
import type { Stroke } from "~/entities/board";

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

function ink(id: number, count = 1): Stroke {
  return {
    id,
    color: "#182230",
    width: 3,
    points: Array.from({ length: count }, (_, i) => ({
      x: i,
      y: 10,
      time: 0,
      pressure: 1,
    })),
  };
}

function factory(auto = true, acknowledge = true) {
  const instances: Array<{
    worker: JobWorker;
    messages: JobRequest[];
    terminated: boolean;
    finish: () => void;
    waitForFinish: () => Promise<void>;
    waitForWindow: () => Promise<void>;
  }> = [];

  return {
    instances,

    create: () => {
      const messages: JobRequest[] = [];

      let lastStrokes: StrokeMetadata[] = [],
        id = 0,
        uploadFinished = deferred<void>(),
        windowFull = deferred<void>(),
        packets = 0;

      const record = {
        messages,
        terminated: false,
        worker: null as unknown as JobWorker,

        finish: () => {},

        waitForFinish: () => uploadFinished.promise,
        waitForWindow: () => windowFull.promise,
      };

      const worker: JobWorker = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,

        terminate: () => {
          record.terminated = true;
        },

        postMessage: ((message: JobRequest) => {
          messages.push(message);

          if ("seq" in message && message.type !== "ack") {
            if (++packets === 2) windowFull.resolve();
          }

          if (acknowledge && "seq" in message && message.type !== "ack")
            worker.onmessage?.call(
              worker as Worker,
              {
                data: { id: message.id, ack: message.seq },
              } as MessageEvent<JobResponse>,
            );

          if (message.type === "start") {
            id = message.id;
            lastStrokes = [];

            uploadFinished = deferred<void>();
            windowFull = deferred<void>();
            packets = 0;
          }

          if (message.type === "strokes") lastStrokes.push(...message.values);

          if (message.type === "finish") {
            uploadFinished.resolve();

            if (auto) queueMicrotask(() => record.finish());
          }

          if (message.type === "close")
            queueMicrotask(() =>
              worker.onmessage?.call(
                worker as Worker,
                {
                  data: { id: message.id },
                } as unknown as MessageEvent<JobResponse>,
              ),
            );
        }) as JobWorker["postMessage"],
      };

      record.worker = worker;

      record.finish = () => {
        void lastStrokes;

        worker.onmessage?.call(
          worker as Worker,
          { data: { id } } as unknown as MessageEvent<JobResponse>,
        );
      };

      instances.push(record);

      return worker;
    },
  };
}

describe("bounded document jobs", () => {
  it("uploads raw points in bounded transferable chunks, yielding while membership/scalars stay captured", async () => {
    const f = factory(),
      a = ink(1, 10000),
      document = { ...DocumentCodec.emptyDocument(), strokes: [a] };

    let clock = 0,
      yields = 0;

    const jobs = new DocumentJobs({
      worker: f.create,
      now: () => clock++,

      yield: async () => {
        yields++;
        document.strokes.push(ink(99));
        document.viewport.x = 123;
      },
    });

    await jobs.write(document);

    const messages = f.instances[0]!.messages,
      chunks = messages.filter((message) => message.type === "points-batch");

    expect(
      chunks.reduce((sum, message) => sum + message.values.length / 4, 0),
    ).toBe(10000);

    expect(chunks.every((message) => message.values.length <= 2048 * 4)).toBe(
      true,
    );

    expect(yields).toBeGreaterThan(0);

    const start = messages.find((message) => message.type === "start")!;

    expect(start.root.viewport.x).toBe(0);

    expect(
      messages
        .filter((message) => message.type === "strokes")
        .flatMap((message) => message.values),
    ).toHaveLength(1);

    await jobs.close();
    expect(f.instances[0]!.terminated).toBe(true);
  });

  it("reuses immutable geometry but resends an evicted source on undo", async () => {
    const f = factory(),
      jobs = new DocumentJobs({ worker: f.create }),
      a = ink(1),
      b = ink(2);

    await jobs.write({ ...DocumentCodec.emptyDocument(), strokes: [a] });

    const count = () =>
      f.instances[0]!.messages.filter(
        (message) => message.type === "points-batch",
      ).length;

    expect(count()).toBe(1);

    await jobs.write({
      ...DocumentCodec.emptyDocument(),
      strokes: [{ ...a, translation: { x: 2, y: 0 }, source: "a" }],
    });

    expect(count()).toBe(1);
    await jobs.write({ ...DocumentCodec.emptyDocument(), strokes: [b] });
    expect(count()).toBe(2);
    await jobs.write({ ...DocumentCodec.emptyDocument(), strokes: [a] });
    expect(count()).toBe(3);
    await jobs.close();
  });

  it("resets source knowledge after worker failure and drains queued saves before close", async () => {
    const f = factory(false),
      jobs = new DocumentJobs({ worker: f.create }),
      a = ink(1);

    const first = jobs.write({
      ...DocumentCodec.emptyDocument(),
      strokes: [a],
    });

    await Promise.resolve();
    await Promise.resolve();

    const failure = expect(first).rejects.toThrow();

    f.instances[0]!.worker.onerror?.call(
      f.instances[0]!.worker as Worker,
      { preventDefault() {} } as ErrorEvent,
    );

    await failure;
    expect(f.instances[0]!.terminated).toBe(true);

    const retry = jobs.write({
      ...DocumentCodec.emptyDocument(),
      strokes: [a],
    });

    await Promise.resolve();
    await f.instances[1]!.waitForFinish();

    expect(
      f.instances[1]!.messages.some(
        (message) => message.type === "points-batch",
      ),
    ).toBe(true);

    let closed = false;

    const close = jobs.close().then(() => {
      closed = true;
    });

    await Promise.resolve();
    expect(closed).toBe(false);
    expect(f.instances[1]!.terminated).toBe(false);
    await f.instances[1]!.waitForFinish();
    f.instances[1]!.finish();
    await retry;
    await close;
    expect(f.instances[1]!.terminated).toBe(true);
  });

  it("cancels an uploading geometry job without affecting a separate durable writer", async () => {
    const geometryFactory = factory(),
      saveFactory = factory(false),
      blocker = deferred<void>();

    let clock = 0;

    const geometry = new DocumentJobs({
      worker: geometryFactory.create,
      now: () => clock++,
      yield: () => blocker.promise,
    });

    const writer = new DocumentJobs({ worker: saveFactory.create }),
      saving = writer.write({
        ...DocumentCodec.emptyDocument(),
        strokes: [ink(1)],
      });

    const controller = new AbortController(),
      selecting = geometry.validate([ink(2, 10000)], controller.signal);

    const cancelled = expect(selecting).rejects.toThrow();

    controller.abort();
    blocker.resolve();
    await cancelled;
    expect(geometryFactory.instances[0]!.terminated).toBe(true);
    expect(saveFactory.instances[0]!.terminated).toBe(false);
    saveFactory.instances[0]!.finish();
    await saving;
    await geometry.close();
    await writer.close();
  });

  it("routes complex existing clips and long lassos to the heavy path independently of point count", () => {
    const stroke = ink(1),
      ring = Array.from(
        { length: 600 },
        (_, i) => [Math.cos(i), Math.sin(i)] as [number, number],
      );

    ring.push(ring[0]!);

    expect(
      DocumentWorkload.heavyDocument([{ ...stroke, clip: [[ring]] }]),
    ).toBe(true);

    expect(
      DocumentWorkload.heavyDocument([stroke], {
        shape: "lasso",
        points: Array.from({ length: 129 }, () => ({ x: 0, y: 0 })),
      }),
    ).toBe(true);

    expect(DocumentWorkload.heavyDocument([stroke])).toBe(false);
  });
});

describe("private background result assembly", () => {
  it("assembles bounded metadata chunks without returning raw points or accepting a partial result", async () => {
    const f = factory(false),
      jobs = new DocumentJobs({ worker: f.create }),
      original = ink(1);

    Object.freeze(original.points[0]);
    Object.freeze(original.points);
    Object.freeze(original);

    let settled = false;

    const selecting = jobs
      .select(
        [original],
        {
          shape: "rectangle",
          points: [
            { x: 0, y: 0 },
            { x: 20, y: 20 },
          ],
        },
        new AbortController().signal,
      )
      .then((value) => {
        settled = true;

        return value;
      });

    await f.instances[0]!.waitForFinish();

    const worker = f.instances[0]!.worker,
      start = f.instances[0]!.messages.find(
        (message) => message.type === "start",
      )!;

    const region = [
      [
        [
          [0, 0],
          [20, 0],
          [20, 20],
          [0, 20],
          [0, 0],
        ],
      ],
    ] as import("~/entities/board").ClipMask;

    const { points: _points, ...metadata } = original;

    worker.onmessage?.call(
      worker as Worker,
      {
        data: {
          id: start.id,
          seq: 1,
          chunk: [
            {
              index: 0,
              same: false,
              selected: { ...metadata, source: "piece", clip: region },
              remainder: null,
            },
          ],
        },
      } as unknown as MessageEvent<JobResponse>,
    );

    await Promise.resolve();
    expect(settled).toBe(false);

    worker.onmessage?.call(
      worker as Worker,
      {
        data: { id: start.id, selection: { region, parts: [] } },
      } as unknown as MessageEvent<JobResponse>,
    );

    const result = await selecting;

    expect(result.parts[0]!.original).toBe(original);

    expect(
      (result.parts[0]!.selected as import("~/entities/board").Stroke).points,
    ).toBe(original.points);

    expect(result.parts[0]!.selected.clip).toEqual(region);
    expect(result.region).toEqual(region);
    await jobs.close();
  });
});

describe("background validation root", () => {
  it("sends the actual captured document metadata instead of validating strokes against defaults", async () => {
    const f = factory(),
      jobs = new DocumentJobs({ worker: f.create }),
      document = DocumentCodec.emptyDocument();

    document.viewport = { x: 123, y: -456, zoom: 4 };
    document.background = "dots";
    document.tools.width = 1.2;
    document.backgroundSettings = { contrast: 73, spacing: 32 };
    document.lastWritingView = { center: { x: 50, y: -10 }, zoom: 2 };

    const validating = jobs.validate(
      [ink(1)],
      new AbortController().signal,
      document,
    );

    document.viewport.x = 999;
    document.tools.width = 9;
    document.backgroundSettings.contrast = 0;
    document.lastWritingView.center.x = 999;
    await validating;

    const start = f.instances[0]!.messages.find(
      (message) => message.type === "start",
    )!;

    expect(start.root.viewport).toEqual({ x: 123, y: -456, zoom: 4 });
    expect(start.root.tools.width).toBe(1.2);
    expect(start.root.background).toBe("dots");

    expect(start.root.backgroundSettings).toEqual({
      contrast: 73,
      spacing: 32,
    });

    expect(start.root.lastWritingView).toEqual({
      center: { x: 50, y: -10 },
      zoom: 2,
    });

    await jobs.close();
  });
});

describe("independent overview jobs", () => {
  it("accepts only the fixed bounded overview result and keeps no raw points in it", async () => {
    const f = factory(false),
      jobs = new DocumentJobs({ worker: f.create });

    expect(f.instances).toHaveLength(0);

    const building = jobs.overview([ink(1)], new AbortController().signal);

    await f.instances[0]!.waitForFinish();

    const record = f.instances[0]!,
      start = record.messages.find((message) => message.type === "start")!,
      overview = {
        width: 256,
        height: 160,
        values: new Uint8Array(256 * 160),
        bounds: null,
      };

    expect(start.kind).toBe("overview");

    record.worker.onmessage?.call(
      record.worker as Worker,
      { data: { id: start.id, overview } } as MessageEvent<JobResponse>,
    );

    expect(await building).toBe(overview);
    expect(overview).not.toHaveProperty("strokes");

    const malformed = jobs.overview([], new AbortController().signal),
      assertion = expect(malformed).rejects.toThrow("корректный обзор");

    await record.waitForFinish();

    const next = record.messages
      .filter((message) => message.type === "start")
      .at(-1)!;

    record.worker.onmessage?.call(
      record.worker as Worker,
      {
        data: {
          id: next.id,
          overview: { ...overview, values: new Uint8Array(1) },
        },
      } as MessageEvent<JobResponse>,
    );

    await assertion;
    await jobs.close();
    expect(record.terminated).toBe(true);
  });

  it("cancels overview upload and releases its worker without interrupting selection or saving", async () => {
    const mapFactory = factory(false),
      selectionFactory = factory(false),
      saveFactory = factory(false),
      blocker = deferred<void>(),
      paused = deferred<void>();

    let clock = 0;

    const map = new DocumentJobs({
        worker: mapFactory.create,
        now: () => clock++,

        yield: () => {
          paused.resolve();

          return blocker.promise;
        },
      }),
      selection = new DocumentJobs({ worker: selectionFactory.create }),
      writer = new DocumentJobs({ worker: saveFactory.create }),
      controller = new AbortController(),
      overview = map.overview([ink(1, 10000)], controller.signal),
      selected = selection.validate([ink(2)], new AbortController().signal),
      saving = writer.write({
        ...DocumentCodec.emptyDocument(),
        strokes: [ink(3)],
      }),
      cancelled = expect(overview).rejects.toMatchObject({
        name: "AbortError",
      });

    await paused.promise;

    await Promise.all([
      selectionFactory.instances[0]!.waitForFinish(),
      saveFactory.instances[0]!.waitForFinish(),
    ]);

    controller.abort();
    blocker.resolve();
    await cancelled;
    expect(mapFactory.instances[0]!.terminated).toBe(true);
    expect(selectionFactory.instances[0]!.terminated).toBe(false);
    expect(saveFactory.instances[0]!.terminated).toBe(false);
    selectionFactory.instances[0]!.finish();
    saveFactory.instances[0]!.finish();
    await selected;
    await saving;
    await map.close();
    await selection.close();
    await writer.close();
  });
});

describe("mixed worker boundaries", () => {
  const image: import("~/entities/board").ImageItem = {
    kind: "image",
    id: 2,
    matrix: [1, 0, 0, 1, 0, 0],
    asset: {
      id: "image",
      mime: "image/png",
      width: 1,
      height: 1,
      base64: "AAAA".repeat(20000),
    },
  };

  it("sends image bounds without encoded pixels during selection", async () => {
    const workers = factory(false),
      jobs = new DocumentJobs({ worker: workers.create });

    const selecting = jobs.select(
      [ink(1), image],
      { shape: "all", points: [] },
      new AbortController().signal,
    );

    await workers.instances[0]!.waitForFinish();

    const messages = workers.instances[0]!.messages,
      start = messages.find((message) => message.type === "start")!;

    expect(start).not.toHaveProperty("root.items");
    expect(start).not.toHaveProperty("root.assets");
    expect(start).not.toHaveProperty("root.strokes");
    expect(messages.some((message) => message.type === "asset")).toBe(false);
    expect(JSON.stringify(messages)).not.toContain(image.asset.base64);

    const metadata = messages.flatMap((message) =>
      message.type === "strokes" ? message.values : [],
    );

    expect(metadata[1]).toMatchObject({
      kind: "image",
      asset: { id: "image", width: 1, height: 1 },
    });

    expect(metadata[1]).not.toHaveProperty("points");
    expect(metadata[1]).not.toHaveProperty("asset.base64");

    workers.instances[0]!.worker.onmessage?.call(
      workers.instances[0]!.worker as Worker,
      {
        data: { id: start.id, selection: { region: [], parts: [] } },
      } as unknown as MessageEvent<JobResponse>,
    );

    await selecting;
    await jobs.close();
  });

  it("uploads assets as bounded independent chunks once for durable saves with immutable board identity", async () => {
    const workers = factory(),
      jobs = new DocumentJobs({ worker: workers.create, boardId: "owned" });

    const board = { ...DocumentCodec.emptyDocument(), strokes: [image] };

    await jobs.write(board);
    await jobs.write(board);

    const messages = workers.instances[0]!.messages,
      chunks = messages.filter((message) => message.type === "asset");

    expect(chunks).toHaveLength(2);
    expect(chunks.every((chunk) => chunk.value.length <= 65536)).toBe(true);
    expect(chunks.map((c) => c.value).join("")).toBe(image.asset.base64);

    expect(
      messages
        .filter((message) => message.type === "start")
        .every((start) => start.boardId === "owned"),
    ).toBe(true);

    await jobs.close();
  });
});

it("routes a large compressed image through worker validation even with no ink points", () => {
  const image: import("~/entities/board").ImageItem = {
    kind: "image",
    id: 1,
    matrix: [1, 0, 0, 1, 0, 0],
    asset: {
      id: "image",
      mime: "image/png",
      width: 4000,
      height: 4000,
      base64: "A".repeat(200000),
    },
  };

  expect(DocumentWorkload.heavyDocument([image])).toBe(true);
});

describe("credit failure cleanup", () => {
  it("rejects an upload blocked on a full credit window when the worker rejects data", async () => {
    const f = factory(false, false),
      jobs = new DocumentJobs({ worker: f.create });

    const pending = jobs.validate(
      [ink(1, 10000)],
      new AbortController().signal,
    );

    const failed = expect(pending).rejects.toThrow();
    const record = f.instances[0]!;

    await record.waitForWindow();

    const start = record.messages.find((message) => message.type === "start")!;

    expect(record.messages.filter((message) => "seq" in message)).toHaveLength(
      2,
    );

    record.worker.onmessage?.call(
      record.worker as Worker,
      {
        data: { id: start.id, error: "invalid image transfer" },
      } as MessageEvent<JobResponse>,
    );

    await failed;
    expect(record.terminated).toBe(true);
    await jobs.close();
  });

  it("rejects and terminates when a reverse chunk acknowledgement cannot be posted", async () => {
    const f = factory(false),
      jobs = new DocumentJobs({ worker: f.create });

    const pending = jobs.select(
      [ink(1)],
      { shape: "all", points: [] },
      new AbortController().signal,
    );

    const failed = expect(pending).rejects.toThrow("ACK failed");
    const record = f.instances[0]!;

    await record.waitForFinish();

    const post = record.worker.postMessage;

    record.worker.postMessage = ((message: JobRequest) => {
      if (message.type === "ack") throw new Error("ACK failed");

      post.call(record.worker, message);
    }) as JobWorker["postMessage"];

    const start = record.messages.find((message) => message.type === "start")!;

    record.worker.onmessage?.call(
      record.worker as Worker,
      {
        data: { id: start.id, seq: 1, chunk: [] },
      } as unknown as MessageEvent<JobResponse>,
    );

    await failed;
    expect(record.terminated).toBe(true);
    await jobs.close();
  });

  it("terminates and rejects a failed close post after draining durable work", async () => {
    const f = factory(),
      jobs = new DocumentJobs({ worker: f.create });

    await jobs.write({ ...DocumentCodec.emptyDocument(), strokes: [ink(1)] });

    const record = f.instances[0]!,
      post = record.worker.postMessage;

    record.worker.postMessage = ((message: JobRequest) => {
      if (message.type === "close") throw new Error("close failed");

      post.call(record.worker, message);
    }) as JobWorker["postMessage"];

    await expect(jobs.close()).rejects.toThrow("close failed");
    expect(record.terminated).toBe(true);
    await expect(jobs.write(DocumentCodec.emptyDocument())).rejects.toThrow();
  });
});
