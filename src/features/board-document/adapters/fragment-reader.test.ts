import { afterEach, describe, expect, it, vi } from "vitest";
import { FragmentReader } from "./fragment-reader";
import type { FragmentReaderTypes } from "./fragment-reader.types";

function setup() {
  const workers: ProbeWorker[] = [];

  class ProbeWorker {
    onmessage:
      ((event: MessageEvent<FragmentReaderTypes.Response>) => void) | null =
      null;
    onerror: ((event: ErrorEvent) => void) | null = null;
    postMessage = vi.fn();
    terminate = vi.fn();

    constructor() {
      workers.push(this);
    }
  }

  vi.stubGlobal("Worker", ProbeWorker);

  return workers;
}

afterEach(() => vi.unstubAllGlobals());

describe("fragment reader cancellation boundary", () => {
  it("terminates pending native preflight on cancellation and ignores its late result", async () => {
    const workers = setup(),
      controller = new AbortController(),
      reading = FragmentReader.read(new Blob(["fragment"]), controller.signal);

    controller.abort();
    await expect(reading).rejects.toThrow("отменена");
    expect(workers[0]!.terminate).toHaveBeenCalledOnce();

    workers[0]!.onmessage!(
      new MessageEvent<FragmentReaderTypes.Response>("message", {
        data: { type: "done", region: [] },
      }),
    );

    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  });

  it("never creates a worker for an already canceled operation", async () => {
    const workers = setup(),
      controller = new AbortController();

    controller.abort();

    await expect(
      FragmentReader.read(new Blob(), controller.signal),
    ).rejects.toThrow("отменена");

    expect(workers).toHaveLength(0);
  });

  it("rejects failed native decode rather than returning partial editable data", async () => {
    const workers = setup(),
      reading = FragmentReader.read(
        new Blob(["fragment"]),
        new AbortController().signal,
      );

    workers[0]!.onmessage!(
      new MessageEvent<FragmentReaderTypes.Response>("message", {
        data: {
          type: "error",
          message: "Не удалось декодировать изображение фрагмента.",
        },
      }),
    );

    await expect(reading).rejects.toThrow(
      "Не удалось декодировать изображение фрагмента.",
    );

    expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  });
});
