import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stroke } from "~/entities/board";
import { DocumentCodec } from "../codec";
import { DocumentJobs } from "./document-jobs";
import type { JobWorker } from "./document-jobs.types";
import type { JobRequest, JobResponse } from "./jobs-protocol";

async function setup() {
  vi.resetModules();

  const requests: JobRequest[] = [],
    transfers: number[] = [];

  const host = {
    onmessage: null as ((event: MessageEvent<JobRequest>) => void) | null,
    postMessage: (data: JobResponse) =>
      queueMicrotask(() =>
        worker.onmessage?.call(
          worker as Worker,
          { data } as MessageEvent<JobResponse>,
        ),
      ),
  };

  const worker: JobWorker = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    terminate: vi.fn(),
    postMessage: ((data: JobRequest, transfer?: Transferable[]) => {
      requests.push(data);

      if (data.type === "points") transfers.push(transfer?.length ?? 0);

      host.onmessage!({ data } as MessageEvent<JobRequest>);
    }) as JobWorker["postMessage"],
  };

  vi.stubGlobal("self", host);
  await import("./jobs-worker");

  return {
    jobs: new DocumentJobs({ worker: () => worker }),
    worker,
    requests,
    transfers,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("background recovery export", () => {
  it("captures membership and all raw samples, retains exact export semantics and never opens a save repository", async () => {
    const h = await setup(),
      ink: Stroke = {
        id: 1,
        width: 3,
        color: "#182230",
        points: Array.from({ length: 10000 }, (_, i) => ({
          x: i,
          y: i % 10,
          pressure: 0.5,
          time: i,
        })),
      },
      document = { ...DocumentCodec.emptyDocument(), strokes: [ink] },
      expected = DocumentCodec.serializeDocument(document),
      exporting = h.jobs.export(document, new AbortController().signal);

    document.strokes.push({ ...ink, id: 2 });
    document.viewport.zoom = 2;

    const result = await exporting;

    expect({ json: await result.blob.text(), warning: result.warning }).toEqual(
      expected,
    );

    expect(h.transfers).toEqual([1, 1, 1, 1, 1]);

    expect(h.requests.filter((r) => r.type === "start")).toMatchObject([
      { kind: "export" },
    ]);

    await h.jobs.close();
    expect(h.worker.terminate).toHaveBeenCalledOnce();
  });

  it("still exports invalid completed content with a recovery warning", async () => {
    const h = await setup(),
      document = DocumentCodec.emptyDocument();

    document.strokes.push({
      id: 1,
      width: 99,
      color: "#182230",
      points: [{ x: 1, y: 2, pressure: 0.5, time: 0 }],
    });

    const result = await h.jobs.export(document, new AbortController().signal);

    expect({ json: await result.blob.text(), warning: result.warning }).toEqual(
      DocumentCodec.serializeDocument(document),
    );

    await h.jobs.close();
  });
});
