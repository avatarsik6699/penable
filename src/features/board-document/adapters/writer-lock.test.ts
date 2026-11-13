import { describe, expect, it, vi } from "vitest";
import { DocumentWriterLease } from "./writer-lock";
function manager(available: boolean) {
  let finished = false;
  const request = vi.fn(
    async (
      _name: string,
      _options: LockOptions,
      callback: (lock: Lock | null) => Promise<void>,
    ) => {
      await callback(
        available
          ? ({
              name: DocumentWriterLease.WRITER_LOCK,
              mode: "exclusive",
            } as Lock)
          : null,
      );
      finished = true;
    },
  );
  return {
    manager: { request } as unknown as LockManager,
    request,
    isFinished: () => finished,
  };
}
describe("writer lease", () => {
  it("holds an exclusive ifAvailable callback until explicit release without signal or stealing", async () => {
    const locks = manager(true);
    const lease = await DocumentWriterLease.acquireWriterLease(locks.manager);
    expect(lease.acquired).toBe(true);
    expect(locks.request.mock.calls[0]?.slice(0, 2)).toEqual([
      DocumentWriterLease.WRITER_LOCK,
      { mode: "exclusive", ifAvailable: true },
    ]);
    expect(locks.isFinished()).toBe(false);
    await lease.release();
    expect(locks.isFinished()).toBe(true);
    await lease.release();
  });
  it("does not wait for or steal an unavailable lease", async () => {
    const locks = manager(false);
    const lease = await DocumentWriterLease.acquireWriterLease(locks.manager);
    expect(lease.acquired).toBe(false);
    expect(lease.message).toContain("просмотр");
    await lease.release();
  });
  it("reports missing capability as read-only instead of inventing a lease", async () => {
    vi.stubGlobal("navigator", { locks: undefined });
    try {
      const lease = await DocumentWriterLease.acquireWriterLease();
      expect(lease.acquired).toBe(false);
      expect(lease.message).toContain("не поддерживает");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
