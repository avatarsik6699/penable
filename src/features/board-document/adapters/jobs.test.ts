import { describe, expect, it } from "vitest";
import { DocumentJobs, type JobWorker, DocumentWorkload } from "./jobs";
import { DocumentCodec } from "../model/codec";
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
function factory(auto = true) {
  const instances: Array<{
    worker: JobWorker;
    messages: JobRequest[];
    terminated: boolean;
    finish: () => void;
  }> = [];
  return {
    instances,
    create: () => {
      const messages: JobRequest[] = [];
      let lastStrokes: StrokeMetadata[] = [],
        id = 0;
      const record = {
        messages,
        terminated: false,
        worker: null as unknown as JobWorker,
        finish: () => {},
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
          if (message.type === "start") {
            id = message.id;
            lastStrokes = [];
          }
          if (message.type === "strokes") lastStrokes.push(...message.values);
          if (message.type === "finish" && auto)
            queueMicrotask(() => record.finish());
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
      chunks = messages.filter((message) => message.type === "points");
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
      f.instances[0]!.messages.filter((message) => message.type === "points")
        .length;
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
    await Promise.resolve();
    await Promise.resolve();
    expect(
      f.instances[1]!.messages.some((message) => message.type === "points"),
    ).toBe(true);
    let closed = false;
    const close = jobs.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);
    expect(f.instances[1]!.terminated).toBe(false);
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
    for (let i = 0; i < 8; i++) await Promise.resolve();
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
    expect(result.parts[0]!.selected.points).toBe(original.points);
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
    const validating = jobs.validate(
      [ink(1)],
      new AbortController().signal,
      document,
    );
    document.viewport.x = 999;
    document.tools.width = 9;
    await validating;
    const start = f.instances[0]!.messages.find(
      (message) => message.type === "start",
    )!;
    expect(start.root.viewport).toEqual({ x: 123, y: -456, zoom: 4 });
    expect(start.root.tools.width).toBe(1.2);
    expect(start.root.background).toBe("dots");
    await jobs.close();
  });
});
