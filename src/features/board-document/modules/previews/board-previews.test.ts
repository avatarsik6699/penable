import { describe, expect, it, vi } from "vitest";
import { BoardPreviews } from "./board-previews";
import type { BoardPreviewsTypes } from "./board-previews.types";

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

async function settle() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const preview = (id: string, bytes = 100): BoardPreviewsTypes.Preview => ({
  url: id,
  bytes,
  release: vi.fn(),
});

describe("lazy board previews", () => {
  it("loads only visible ids, runs one job at a time, cancels closed work and releases late results", async () => {
    const pending = deferred<BoardPreviewsTypes.Preview>(),
      load = vi.fn(async (_id: string, _signal: AbortSignal) => new Blob()),
      render = vi.fn(() => pending.promise),
      service = new BoardPreviews({
        load,
        render,

        changed: () => {},
      });

    service.show(["one", "two"]);
    await settle();
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0]).toBe("one");
    service.close();

    const late = preview("late");

    pending.resolve(late);
    await settle();
    expect(late.release).toHaveBeenCalledOnce();
    expect(service.urls).toEqual({});
    expect(load).toHaveBeenCalledTimes(1);
    await service.dispose();
  });

  it("enforces the entry and encoded-byte LRU limits and invalidates edited boards", async () => {
    const values: BoardPreviewsTypes.Preview[] = [],
      service = new BoardPreviews({
        load: async (id) => new Blob([id]),

        render: async (blob) => {
          const value = preview(await blob.text(), 300000);

          values.push(value);

          return value;
        },

        changed: () => {},
      });

    for (let i = 0; i < 35; i++) {
      service.show([String(i)]);
      await settle();
    }

    expect(Object.keys(service.urls).length).toBeLessThanOrEqual(27);
    expect(values[0]!.release).toHaveBeenCalledOnce();
    service.close();
    service.invalidate("34");
    expect(values.at(-1)!.release).toHaveBeenCalledOnce();
    expect(service.urls["34"]).toBeUndefined();
    await service.dispose();

    expect(
      values.every(
        (value) =>
          (value.release as ReturnType<typeof vi.fn>).mock.calls.length === 1,
      ),
    ).toBe(true);
  });

  it("failed previews remain placeholders and do not prevent later boards or retry after close", async () => {
    const load = vi.fn(async (id: string) => {
        if (id === "bad") throw new Error("read");

        return new Blob();
      }),
      service = new BoardPreviews({
        load,
        render: async () => preview("good"),

        changed: () => {},
      });

    service.show(["bad", "good"]);
    await settle();
    expect(service.urls).toEqual({ good: "good" });
    service.close();
    service.show(["bad"]);
    await settle();
    expect(load.mock.calls.filter((call) => call[0] === "bad")).toHaveLength(2);
    await service.dispose();
  });
});
