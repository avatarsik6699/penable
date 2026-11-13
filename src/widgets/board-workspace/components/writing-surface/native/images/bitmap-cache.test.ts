import { afterEach, describe, it, expect, vi } from "vitest";
import { ImageAssets } from "~/features/board-document";
import { BitmapCache } from "./bitmap-cache";
import type { ImageAsset } from "~/entities/board";

const asset: ImageAsset = {
  id: "image",
  mime: "image/png",
  width: 1,
  height: 1,
  base64:
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=",
};

afterEach(() => vi.unstubAllGlobals());

describe("generation bitmap ownership", () => {
  it("reuses immutable asset decode and closes exactly once on disposal", async () => {
    const close = vi.fn(),
      decode = vi.fn(async () => ({ width: 1, height: 1, close }));

    vi.stubGlobal("createImageBitmap", decode);

    const cache = new BitmapCache();

    await Promise.all([cache.ensure(asset), cache.ensure(asset)]);
    expect(decode).toHaveBeenCalledOnce();
    expect(cache.get(asset)).not.toBeNull();
    cache.dispose();
    cache.dispose();
    expect(close).toHaveBeenCalledOnce();
  });

  it("closes late successful decode after generation disposal without presenting it", async () => {
    let resolve!: (bitmap: unknown) => void;

    const close = vi.fn(),
      changed = vi.fn();

    vi.stubGlobal(
      "createImageBitmap",
      () =>
        new Promise((yes) => {
          resolve = yes;
        }),
    );

    const cache = new BitmapCache(changed),
      pending = cache.ensure(asset);

    cache.dispose();
    resolve({ width: 1, height: 1, close });
    await expect(pending).rejects.toThrow("отменена");
    expect(close).toHaveBeenCalledOnce();
    expect(changed).not.toHaveBeenCalled();
  });

  it.each([
    { width: 9000, height: 1 },
    { width: 2, height: 1 },
  ])("closes an invalid decoded bitmap %j", async (size) => {
    const close = vi.fn();

    vi.stubGlobal("createImageBitmap", async () => ({ ...size, close }));

    const cache = new BitmapCache();

    await expect(cache.ensure(asset)).rejects.toThrow();
    expect(close).toHaveBeenCalledOnce();
    expect(cache.get(asset)).toBeNull();
    cache.dispose();
  });
});

it("releases removed active assets and decodes again when undo restores the immutable bytes", async () => {
  const closed = [vi.fn(), vi.fn()];
  let next = 0;

  const decode = vi.fn(async () => ({
    width: 1,
    height: 1,
    close: closed[next++]!,
  }));

  vi.stubGlobal("createImageBitmap", decode);

  const cache = new BitmapCache();

  await cache.ensure(asset);
  cache.retain([]);
  expect(closed[0]).toHaveBeenCalledOnce();
  expect(cache.get(asset)).toBeNull();
  await cache.ensure(asset);
  expect(decode).toHaveBeenCalledTimes(2);
  cache.dispose();
  expect(closed[1]).toHaveBeenCalledOnce();
});

it("keeps a newer claim and closes only after every pending owner releases the same asset", async () => {
  const close = vi.fn();

  vi.stubGlobal("createImageBitmap", async () => ({
    width: 1,
    height: 1,
    close,
  }));

  const cache = new BitmapCache(),
    first = cache.claim(asset),
    second = cache.claim(asset);

  await first.ready;
  first.release(false);
  cache.retain([]);
  expect(close).not.toHaveBeenCalled();
  expect(cache.get(asset)).not.toBeNull();
  second.release(false);
  expect(close).toHaveBeenCalledOnce();
  cache.dispose();
  expect(close).toHaveBeenCalledOnce();
});

it("uses strict native base64 decoding for immutable image reloads after undo", async () => {
  const OriginalArray = Uint8Array,
    bytes = ImageAssets.decodeBase64(asset.base64),
    decode = vi.fn(() => new OriginalArray(bytes)),
    close = vi.fn();

  class NativeArray extends OriginalArray {
    static fromBase64 = decode;
  }

  vi.stubGlobal("Uint8Array", NativeArray);

  vi.stubGlobal("createImageBitmap", async () => ({
    width: 1,
    height: 1,
    close,
  }));

  const cache = new BitmapCache();

  await cache.ensure(asset);
  cache.retain([]);
  await cache.ensure(asset);
  expect(decode).toHaveBeenCalledTimes(2);

  expect(decode).toHaveBeenCalledWith(asset.base64, {
    lastChunkHandling: "strict",
  });

  cache.dispose();
});

it("keeps the bounded canonical decoder fallback when native base64 is unavailable", async () => {
  const OriginalArray = Uint8Array,
    close = vi.fn();

  class LegacyArray extends OriginalArray {}
  Object.defineProperty(LegacyArray, "fromBase64", { value: undefined });
  vi.stubGlobal("Uint8Array", LegacyArray);

  vi.stubGlobal("createImageBitmap", async () => ({
    width: 1,
    height: 1,
    close,
  }));

  const cache = new BitmapCache();

  await cache.ensure(asset);
  expect(cache.get(asset)).not.toBeNull();
  cache.dispose();
  expect(close).toHaveBeenCalledOnce();
});
