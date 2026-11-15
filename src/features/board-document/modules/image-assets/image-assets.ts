import { Messages } from "~/shared/lib/messages";
import type { BoardItem, ImageAsset } from "~/entities/board";

const LIMITS = {
  bytes: 8 * 1024 * 1024,
  side: 8192,
  pixels: 16000000,
  boardBytes: 32 * 1024 * 1024,
  boardPixels: 32000000,
  count: 100,
};

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function fail(message = Messages.create("invalidPngJpegImage")): never {
  throw Messages.error(message);
}

function decodeBase64(text: string): Uint8Array {
  if (
    typeof text !== "string" ||
    !text.length ||
    text.length > Math.ceil(LIMITS.bytes / 3) * 4 ||
    text.length % 4
  )
    fail(Messages.create("invalidOrOversizedImageData"));

  const padding = text.endsWith("==") ? 2 : text.endsWith("=") ? 1 : 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    const valid =
      (code >= 65 && code <= 90) ||
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      code === 43 ||
      code === 47;

    if (!valid && !(code === 61 && i >= text.length - padding))
      fail(Messages.create("invalidImageBase64Data"));
  }

  const length = (text.length / 4) * 3 - padding;

  if (length > LIMITS.bytes) fail(Messages.create("imageExceeds8Mib"));

  const result = new Uint8Array(length);
  let index = 0;

  for (let i = 0; i < text.length; i += 4) {
    const a = ALPHABET.indexOf(text[i]!),
      b = ALPHABET.indexOf(text[i + 1]!),
      c = ALPHABET.indexOf(text[i + 2]!),
      d = ALPHABET.indexOf(text[i + 3]!);

    if (
      i + 4 === text.length &&
      ((padding === 2 && b % 16 !== 0) || (padding === 1 && c % 4 !== 0))
    )
      fail();

    const value =
      (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);

    if (index < length) result[index++] = value >> 16;

    if (index < length) result[index++] = value >> 8;

    if (index < length) result[index++] = value;
  }

  return result;
}

function encodeBase64(bytes: Uint8Array): string {
  const chunks: string[] = [];
  let part = "";

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!,
      b = bytes[i + 1],
      c = bytes[i + 2],
      v = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);

    part +=
      ALPHABET[(v >>> 18) & 63]! +
      ALPHABET[(v >>> 12) & 63]! +
      (b === undefined ? "=" : ALPHABET[(v >>> 6) & 63]!) +
      (c === undefined ? "=" : ALPHABET[v & 63]!);

    if (part.length >= 16384) {
      chunks.push(part);
      part = "";
    }
  }

  chunks.push(part);

  return chunks.join("");
}

function dimensions(width: number, height: number) {
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > LIMITS.side ||
    height > LIMITS.side ||
    width * height > LIMITS.pixels
  )
    fail(Messages.create("imageExceeds8192PixelsPerSideOr"));
}

function inspect(bytes: Uint8Array): {
  mime: ImageAsset["mime"];
  width: number;
  height: number;
} {
  if (!bytes.length || bytes.length > LIMITS.bytes)
    fail(Messages.create("imageExceeds8Mib"));

  if (
    bytes.length >= 33 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  ) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    if (
      view.getUint32(8) !== 13 ||
      String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
    )
      fail();

    const width = view.getUint32(16),
      height = view.getUint32(20);

    dimensions(width, height);

    return { mime: "image/png", width, height };
  }

  if (bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2,
      orientation = 1,
      width = 0,
      height = 0;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    while (offset + 4 <= bytes.length) {
      if (bytes[offset++] !== 255) fail();

      while (bytes[offset] === 255) offset++;

      const marker = bytes[offset++]!;

      if (marker === 217 || marker === 218) break;

      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;

      const length = (bytes[offset]! << 8) | bytes[offset + 1]!;

      if (length < 2 || offset + length > bytes.length) fail();

      if (
        marker === 225 &&
        length >= 16 &&
        String.fromCharCode(...bytes.slice(offset + 2, offset + 8)) ===
          "Exif\0\0"
      ) {
        const tiff = offset + 8,
          end = offset + length;

        const order = view.getUint16(tiff),
          little = order === 0x4949;

        if (
          (order !== 0x4949 && order !== 0x4d4d) ||
          view.getUint16(tiff + 2, little) !== 42
        )
          fail();

        const directory = tiff + view.getUint32(tiff + 4, little);

        if (directory < tiff + 8 || directory + 2 > end) fail();

        const count = view.getUint16(directory, little);

        if (directory + 2 + count * 12 + 4 > end) fail();

        for (let index = 0; index < count; index++) {
          const entry = directory + 2 + index * 12;

          if (view.getUint16(entry, little) === 0x112) {
            if (
              view.getUint16(entry + 2, little) !== 3 ||
              view.getUint32(entry + 4, little) !== 1
            )
              fail();

            orientation = view.getUint16(entry + 8, little);

            if (orientation < 1 || orientation > 8) fail();
          }
        }
      }

      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker)
      ) {
        if (length < 8) fail();

        height = (bytes[offset + 3]! << 8) | bytes[offset + 4]!;
        width = (bytes[offset + 5]! << 8) | bytes[offset + 6]!;
        dimensions(width, height);
      }

      offset += length;
    }

    if (width && height)
      return {
        mime: "image/jpeg",
        width: orientation >= 5 ? height : width,
        height: orientation >= 5 ? width : height,
      };
  }

  return fail();
}

function validateAsset(asset: ImageAsset): void {
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(asset.id))
    fail(Messages.create("invalidImageIdentifier"));

  const actual = inspect(decodeBase64(asset.base64));

  if (
    asset.mime !== actual.mime ||
    asset.width !== actual.width ||
    asset.height !== actual.height
  )
    fail(Messages.create("imageSizeOrTypeDoesNotMatch"));
}

function unique(items: readonly BoardItem[]): ImageAsset[] {
  const identities = new Map<string, ImageAsset>(),
    payloads = new Map<string, ImageAsset>();

  for (const item of items)
    if (item.kind === "image") {
      const previous = identities.get(item.asset.id);

      if (
        previous &&
        (previous.base64 !== item.asset.base64 ||
          previous.mime !== item.asset.mime ||
          previous.width !== item.asset.width ||
          previous.height !== item.asset.height)
      )
        fail(Messages.create("conflictingImageIdentifiers"));

      identities.set(item.asset.id, item.asset);
      payloads.set(item.asset.base64, item.asset);
    }

  return [...payloads.values()];
}

function validateBoard(items: readonly BoardItem[], full = true): void {
  const assets = unique(items);

  if (assets.length > LIMITS.count)
    fail(Messages.create("aBoardCanContainUpTo100"));

  let bytes = 0,
    pixels = 0;

  for (const asset of assets) {
    if (full) validateAsset(asset);

    bytes +=
      (asset.base64.length / 4) * 3 -
      (asset.base64.endsWith("==") ? 2 : asset.base64.endsWith("=") ? 1 : 0);

    pixels += asset.width * asset.height;
  }

  if (bytes > LIMITS.boardBytes || pixels > LIMITS.boardPixels)
    fail(Messages.create("boardImagesExceed32MibOr32"));
}

function reconcile(
  items: readonly BoardItem[],
  inserted: readonly BoardItem[],
): BoardItem[] {
  const known = new Map<string, ImageAsset>();

  for (const item of items)
    if (item.kind === "image") known.set(item.asset.id, item.asset);

  const mapped = new Map<ImageAsset, ImageAsset>();

  return inserted.map((item) => {
    if (item.kind !== "image") return item;

    let asset = mapped.get(item.asset);

    if (!asset) {
      asset =
        [...known.values()].find(
          (a) => a.base64 === item.asset.base64 && a.mime === item.asset.mime,
        ) ?? item.asset;

      if (known.has(asset.id) && known.get(asset.id) !== asset) {
        let i = 1;

        while (known.has(`${asset.id.slice(0, 140)}_${i}`)) i++;

        asset = { ...asset, id: `${asset.id.slice(0, 140)}_${i}` };
      }

      known.set(asset.id, asset);
      mapped.set(item.asset, asset);
    }

    return { ...item, asset };
  });
}

export const ImageAssets = {
  LIMITS,
  inspect,
  dimensions,
  decodeBase64,
  encodeBase64,
  validateAsset,
  validateBoard,
  unique,
  reconcile,
};
