import { describe, it, expect } from "vitest";
import { ImageAssets } from "./image-assets";
import type { ImageItem, ImageAsset } from "~/entities/board";

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

const asset: ImageAsset = {
  id: "image",
  mime: "image/png",
  width: 1,
  height: 1,
  base64,
};

const item = (value = asset): ImageItem => ({
  kind: "image",
  id: 1,
  asset: value,
  matrix: [1, 0, 0, 1, 0, 0],
});

describe("bounded embedded raster assets", () => {
  it("checks signature and header size before any native decode", () => {
    expect(ImageAssets.inspect(ImageAssets.decodeBase64(base64))).toEqual({
      mime: "image/png",
      width: 1,
      height: 1,
    });

    expect(() =>
      ImageAssets.inspect(new TextEncoder().encode('<svg width="1"/>')),
    ).toThrow("PNG/JPEG");

    const bytes = ImageAssets.decodeBase64(base64);

    new DataView(bytes.buffer).setUint32(16, 8193);
    expect(() => ImageAssets.inspect(bytes)).toThrow("8192");
  });

  it("decodes the full permitted eight MiB without recursive regex overflow", () => {
    expect(ImageAssets.decodeBase64("A".repeat(11_184_811) + "=")).toHaveLength(
      8 * 1024 * 1024,
    );
  });

  it.each([
    "A===",
    "AB==",
    "AAB=",
    "AA A",
    "data:image/png;base64,AAAA",
    "AAAA=",
    "====",
  ])("rejects malformed or noncanonical base64 %s", (value) => {
    expect(() => ImageAssets.decodeBase64(value)).toThrow();
  });

  it("counts identical bytes once and rejects conflicting asset IDs", () => {
    expect(ImageAssets.unique([item(), { ...item(), id: 2 }])).toHaveLength(1);

    expect(() =>
      ImageAssets.validateBoard([
        item(),
        item({ ...asset, base64: base64.slice(0, -4) + "AAAA" }),
      ]),
    ).toThrow("Конфликт");
  });

  it("resolves cross-board asset ID collisions and deduplicates identical payloads", () => {
    const other = { ...asset, base64: base64.slice(0, -4) + "AAAA" };

    const inserted = ImageAssets.reconcile(
      [item()],
      [item(other), { ...item(other), id: 2 }],
    ) as ImageItem[];

    expect(inserted[0]!.asset.id).not.toBe(asset.id);
    expect(inserted[1]!.asset).toBe(inserted[0]!.asset);

    expect(
      (
        ImageAssets.reconcile(
          [item()],
          [item({ ...asset, id: "other" })],
        )[0] as ImageItem
      ).asset,
    ).toBe(asset);
  });

  it("reads bounded TIFF orientation before returning JPEG natural dimensions", () => {
    const bytes = new Uint8Array([
      255, 216, 255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0,
      0, 0, 1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 255, 192, 0,
      11, 8, 0, 160, 0, 240, 1, 1, 17, 0, 255, 217,
    ]);

    expect(ImageAssets.inspect(bytes)).toEqual({
      mime: "image/jpeg",
      width: 160,
      height: 240,
    });
  });
});
