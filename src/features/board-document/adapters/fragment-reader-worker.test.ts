import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardConstants, BoardRegions, type ImageItem } from "~/entities/board";
import { FragmentCodec } from "../modules/fragments";
import { ImageAssets } from "../modules/image-assets";
import type { FragmentReaderTypes } from "./fragment-reader.types";

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

const image: ImageItem = {
  kind: "image",
  id: 1,
  matrix: [1, 0, 0, 1, 0, 0],
  asset: { id: "image", mime: "image/png", width: 1, height: 1, base64 },
};

const region = BoardRegions.rectangle({ x: -10, y: -10 }, { x: 10, y: 10 });

async function execute(items: ImageItem[]) {
  vi.resetModules();

  const responses: FragmentReaderTypes.Response[] = [];
  let resolve!: (messages: FragmentReaderTypes.Response[]) => void;

  const result = new Promise<FragmentReaderTypes.Response[]>((yes) => {
    resolve = yes;
  });

  const host = {
    onmessage: null as ((event: MessageEvent<Blob>) => void) | null,

    postMessage: (message: FragmentReaderTypes.Response) => {
      responses.push(message);

      if (message.type === "done" || message.type === "error")
        resolve(responses);
    },
  };

  vi.stubGlobal("self", host);
  await import("./fragment-reader-worker");

  const blob = new Blob([FragmentCodec.serialize({ strokes: items, region })]);

  host.onmessage!({ data: blob } as MessageEvent<Blob>);

  return result;
}

afterEach(() => vi.unstubAllGlobals());

describe("editable clipboard native image preflight", () => {
  it("rejects a valid PNG header with a truncated body before transferring any editable content", async () => {
    const header = ImageAssets.decodeBase64(base64).slice(0, 33),
      truncated = {
        ...image,
        asset: { ...image.asset, base64: ImageAssets.encodeBase64(header) },
      };

    expect(() =>
      FragmentCodec.serialize({ strokes: [truncated], region }),
    ).not.toThrow();

    const decode = vi.fn(async () => {
      throw new DOMException(
        "The source image could not be decoded.",
        "InvalidStateError",
      );
    });

    vi.stubGlobal("createImageBitmap", decode);

    const messages = await execute([truncated]);

    expect(decode).toHaveBeenCalledOnce();

    expect(messages).toEqual([
      {
        type: "error",
        message: "Не удалось декодировать изображение фрагмента.",
      },
    ]);
  });

  it("checks native dimensions, closes the bitmap and rejects before transfer", async () => {
    const close = vi.fn();

    vi.stubGlobal("createImageBitmap", async () => ({
      width: 2,
      height: 1,
      close,
    }));

    const messages = await execute([image]);

    expect(close).toHaveBeenCalledOnce();

    expect(messages).toEqual([
      {
        type: "error",
        message: "Не удалось декодировать изображение фрагмента.",
      },
    ]);
  });

  it("deduplicates and closes validated bitmaps before returning the editable fragment", async () => {
    const close = vi.fn(),
      decode = vi.fn(async () => ({ width: 1, height: 1, close }));

    vi.stubGlobal("createImageBitmap", decode);

    const messages = await execute([image, { ...image, id: 2 }]);

    expect(decode).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(messages.at(-1)?.type).toBe("done");

    expect(messages.filter((message) => message.type === "item")).toHaveLength(
      2,
    );
  });

  it("keeps vector-only fragments independent of image decoding", async () => {
    vi.resetModules();

    const responses: FragmentReaderTypes.Response[] = [];
    let resolve!: () => void;

    const result = new Promise<void>((yes) => {
      resolve = yes;
    });

    const host = {
      onmessage: null as ((event: MessageEvent<Blob>) => void) | null,

      postMessage: (message: FragmentReaderTypes.Response) => {
        responses.push(message);

        if (message.type === "done" || message.type === "error") resolve();
      },
    };

    vi.stubGlobal("self", host);
    await import("./fragment-reader-worker");

    const decode = vi.fn();

    vi.stubGlobal("createImageBitmap", decode);

    host.onmessage!({
      data: new Blob([
        FragmentCodec.serialize({
          strokes: [
            {
              id: 3,
              width: 2,
              color: BoardConstants.INK,
              points: [{ x: 0, y: 0, pressure: 0.5, time: 0 }],
            },
          ],
          region,
        }),
      ]),
    } as MessageEvent<Blob>);

    await result;
    expect(decode).not.toHaveBeenCalled();
    expect(responses.at(-1)?.type).toBe("done");
  });
});
