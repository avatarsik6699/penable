import { afterEach, describe, it, expect, vi } from "vitest";
import { ImageInput } from "./image-input";
import { BitmapCache } from "./bitmap-cache";
import { ImageAssets } from "~/features/board-document";
import type { ImageItem, Scene } from "~/entities/board";

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

function setup(
  scene: Scene = { strokes: [], active: null },
  insert: (
    items: import("~/entities/board").BoardItem[],
  ) => void | Promise<boolean> = () => {},
) {
  const nativeInput = Object.assign(new EventTarget(), {
    setAttribute: vi.fn(),
    remove: vi.fn(),
    click: vi.fn(),
  });

  vi.stubGlobal("document", {
    createElement: () => nativeInput,
    body: { append: vi.fn() },
  });

  vi.stubGlobal("window", new EventTarget());

  const canvas = Object.assign(new EventTarget(), {
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 800,
        height: 600,
      }),
    }),
    cache = new BitmapCache();

  const claim = vi.spyOn(cache, "claim"),
    notice = vi.fn(),
    input = new ImageInput({
      canvas: canvas as unknown as HTMLCanvasElement,
      scene,
      images: cache,
      viewport: () => ({ x: 0, y: 0, zoom: 1 }),
      allowed: () => true,
      insert,

      notice,

      changed: () => {},
    });

  return {
    input,
    nativeInput,
    cache,
    claim,
    notice,
    file: new Blob([ImageAssets.decodeBase64(base64) as BlobPart], {
      type: "image/png",
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("pending image insertion ownership", () => {
  it("keeps decode alive across picker blur, reports choosing/cancel, and accepts the same file again", async () => {
    const decoded = deferred<ImageBitmap>(),
      started = deferred<void>(),
      insert = vi.fn();

    vi.stubGlobal("createImageBitmap", () => {
      started.resolve();

      return decoded.promise;
    });

    const h = setup(undefined, insert);

    h.input.open();
    expect(h.input.status.phase).toBe("choosing");
    expect(h.input.busy).toBe(true);
    h.nativeInput.dispatchEvent(new Event("cancel"));
    expect(h.input.status.phase).toBe("idle");
    expect(h.input.busy).toBe(false);
    h.input.open();

    const pending = h.input.insertFile(h.file);

    await started.promise;
    window.dispatchEvent(new Event("blur"));
    expect(h.input.busy).toBe(true);

    decoded.resolve({
      width: 1,
      height: 1,
      close: vi.fn(),
    } as unknown as ImageBitmap);

    await pending;
    expect(insert).toHaveBeenCalledOnce();
    expect(h.input.status.phase).toBe("success");
    await h.input.insertFile(h.file);
    expect(insert).toHaveBeenCalledTimes(2);
    h.input.dispose();
    h.cache.dispose();
  });

  it("failed files report a retryable error without inserting", async () => {
    const insert = vi.fn(),
      h = setup(undefined, insert);

    await h.input.insertFile(new Blob(["broken"]));
    expect(insert).not.toHaveBeenCalled();
    expect(h.input.status.phase).toBe("error");
    expect(h.input.busy).toBe(false);
    h.input.dispose();
    h.cache.dispose();
  });

  it("ends a rejected atomic insertion with retryable error and releases temporary bitmap", async () => {
    const close = vi.fn(),
      insert = vi.fn(async () => false);

    vi.stubGlobal("createImageBitmap", async () => ({
      width: 1,
      height: 1,
      close,
    }));

    const h = setup(undefined, insert);

    await h.input.insertFile(h.file);
    expect(h.input.busy).toBe(false);
    expect(h.input.status.phase).toBe("error");
    expect(h.input.status.message).toContain("Повторите");
    expect(close).toHaveBeenCalledOnce();
    h.input.dismiss();
    expect(h.input.status.phase).toBe("idle");
    h.input.dispose();
    h.cache.dispose();
  });

  it("closes a canceled delayed decode exactly once without inserting or keeping its bitmap", async () => {
    const started = deferred<void>(),
      decoded = deferred<ImageBitmap>(),
      close = vi.fn(),
      insert = vi.fn();

    vi.stubGlobal("createImageBitmap", () => {
      started.resolve();

      return decoded.promise;
    });

    const h = setup(undefined, insert),
      pending = h.input.insertFile(h.file);

    await started.promise;

    const asset = h.claim.mock.calls[0]![0];

    h.input.cancel();
    decoded.resolve({ width: 1, height: 1, close } as unknown as ImageBitmap);
    await pending;
    expect(insert).not.toHaveBeenCalled();
    expect(h.cache.get(asset)).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(h.notice).not.toHaveBeenCalled();
    h.input.dispose();
    h.cache.dispose();
    expect(close).toHaveBeenCalledOnce();
  });

  it("an older canceled operation cannot evict a newer pending asset", async () => {
    const first = deferred<ImageBitmap>(),
      second = deferred<ImageBitmap>(),
      starts = [deferred<void>(), deferred<void>()],
      closes = [vi.fn(), vi.fn()];

    let next = 0;

    vi.stubGlobal("createImageBitmap", () => {
      const index = next++;

      starts[index]!.resolve();

      return index ? second.promise : first.promise;
    });

    const h = setup(),
      old = h.input.insertFile(h.file);

    await starts[0]!.promise;
    h.input.cancel();

    const current = h.input.insertFile(h.file);

    await starts[1]!.promise;

    first.resolve({
      width: 1,
      height: 1,
      close: closes[0],
    } as unknown as ImageBitmap);

    await old;
    expect(h.input.busy).toBe(true);
    expect(closes[0]).toHaveBeenCalledOnce();
    expect(closes[1]).not.toHaveBeenCalled();
    h.input.cancel();

    second.resolve({
      width: 1,
      height: 1,
      close: closes[1],
    } as unknown as ImageBitmap);

    await current;
    expect(closes[1]).toHaveBeenCalledOnce();
    h.input.dispose();
    h.cache.dispose();
  });

  it("keeps a reused canonical asset when pending duplicate insertion is canceled", async () => {
    const close = vi.fn();

    vi.stubGlobal("createImageBitmap", async () => ({
      width: 1,
      height: 1,
      close,
    }));

    const image: ImageItem = {
        kind: "image",
        id: 1,
        matrix: [1, 0, 0, 1, 0, 0],
        asset: {
          id: "canonical",
          mime: "image/png",
          width: 1,
          height: 1,
          base64,
        },
      },
      started = deferred<void>(),
      validation = deferred<boolean>();

    const h = setup({ strokes: [image], active: null }, () => {
      started.resolve();

      return validation.promise;
    });

    await h.cache.ensure(image.asset);

    const pending = h.input.insertFile(h.file);

    await started.promise;
    h.input.cancel();
    validation.resolve(false);
    await pending;
    expect(h.cache.get(image.asset)).not.toBeNull();
    expect(close).not.toHaveBeenCalled();
    h.input.dispose();
    h.cache.dispose();
    expect(close).toHaveBeenCalledOnce();
  });
});
