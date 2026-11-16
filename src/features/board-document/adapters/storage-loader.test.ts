import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentStorageLoader } from "./storage-loader";

afterEach(() => vi.unstubAllGlobals());

describe("production snapshot-loader startup recovery", () => {
  it("returns the independent strict repository path when module Worker startup is blocked", async () => {
    vi.stubGlobal(
      "Worker",
      class {
        constructor() {
          throw new Error("worker assets blocked");
        }
      },
    );

    expect(
      await DocumentStorageLoader.load("main", new AbortController().signal),
    ).toBeNull();
  });

  it("propagates cancellation without entering the synchronous startup fallback", async () => {
    const worker = vi.fn(),
      controller = new AbortController();

    vi.stubGlobal("Worker", worker);
    controller.abort();

    await expect(
      DocumentStorageLoader.load("main", controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(worker).not.toHaveBeenCalled();
  });
});
