import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stroke } from "~/entities/board";
import { DocumentCodec } from "../modules/codec";
import { DocumentExports } from "./document-exports";

function document() {
  const value = DocumentCodec.emptyDocument();

  value.strokes.push({
    id: 1,
    width: 3,
    color: "#182230",
    points: [{ x: 5, y: 7, pressure: 0.4, time: 11 }],
  });

  return value;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("independent emergency download", () => {
  it("preserves completed content and recovery warnings when worker construction is blocked", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("worker blocked");
        }
      },
    );

    const value = document();

    (value.strokes[0]! as Stroke).width = 99;

    const expected = DocumentCodec.serializeDocument(value);

    expect(
      await DocumentExports.serialize(value, new AbortController().signal),
    ).toEqual({ contents: expected.json, warning: expected.warning });
  });

  it("falls back after an asynchronous worker startup failure and closes the owned worker", async () => {
    const terminate = vi.fn();

    vi.stubGlobal(
      "Worker",
      class {
        onmessage = null;
        onmessageerror = null;
        onerror: ((event: ErrorEvent) => void) | null = null;
        terminate = terminate;

        postMessage() {
          queueMicrotask(() =>
            this.onerror?.({ preventDefault() {} } as ErrorEvent),
          );
        }
      },
    );

    const value = document(),
      expected = DocumentCodec.serializeDocument(value);

    expect(
      await DocumentExports.serialize(value, new AbortController().signal),
    ).toEqual({ contents: expected.json, warning: expected.warning });

    expect(terminate).toHaveBeenCalledOnce();
  });

  it.each(["before", "during"])(
    "never runs a fallback or produces a download when canceled %s processing",
    async (phase) => {
      const controller = new AbortController(),
        serialize = vi.spyOn(DocumentCodec, "serializeDocument"),
        terminate = vi.fn();

      vi.stubGlobal(
        "Worker",
        class {
          onmessage = null;
          onmessageerror = null;
          onerror = null;

          postMessage() {}

          terminate = terminate;
        },
      );

      if (phase === "before") controller.abort();

      const exporting = DocumentExports.serialize(
        document(),
        controller.signal,
      );

      if (phase === "during") controller.abort();

      await expect(exporting).rejects.toMatchObject({ name: "AbortError" });
      expect(serialize).not.toHaveBeenCalled();
      expect(terminate).toHaveBeenCalledTimes(phase === "during" ? 1 : 0);
    },
  );
});
