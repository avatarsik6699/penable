import { afterEach, describe, it, expect, vi } from "vitest";
import { ImagePreflight } from "./image-preflight";
import { DocumentCodec } from "../modules/codec";
import type { ImageItem } from "~/entities/board";

const image: ImageItem = {
  kind: "image",
  id: 1,
  matrix: [1, 0, 0, 1, 0, 0],
  asset: {
    id: "image",
    mime: "image/png",
    width: 1,
    height: 1,
    base64:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=",
  },
};

afterEach(() => vi.unstubAllGlobals());

describe("native image replacement preflight", () => {
  it("checks deduplicated resources and closes decoded bitmap before replacement", async () => {
    const close = vi.fn(),
      decode = vi.fn(async () => ({ width: 1, height: 1, close }));

    vi.stubGlobal("createImageBitmap", decode);

    await ImagePreflight.validate(
      {
        ...DocumentCodec.emptyDocument(),
        strokes: [image, { ...image, id: 2 }],
      },
      new AbortController().signal,
    );

    expect(decode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it("propagates corrupt native decode instead of accepting a valid header alone", async () => {
    vi.stubGlobal("createImageBitmap", async () => {
      throw new Error("corrupt PNG");
    });

    await expect(
      ImagePreflight.validate(
        { ...DocumentCodec.emptyDocument(), strokes: [image] },
        new AbortController().signal,
      ),
    ).rejects.toThrow("corrupt");
  });

  it("closes on cancellation and oriented-size failure", async () => {
    const controller = new AbortController(),
      close = vi.fn();

    vi.stubGlobal("createImageBitmap", async () => {
      controller.abort();

      return { width: 2, height: 1, close };
    });

    await expect(
      ImagePreflight.validate(
        { ...DocumentCodec.emptyDocument(), strokes: [image] },
        controller.signal,
      ),
    ).rejects.toThrow("отменена");

    expect(close).toHaveBeenCalledOnce();
  });
});
