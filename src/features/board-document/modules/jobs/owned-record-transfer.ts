import { CreditWindow } from "./credit-window";
import type { OwnedRecordPacket } from "./document-reader.types";

// Raw storage data stays untyped until the unchanged strict decoder runs in the Worker.
// Unsupported prototypes/cycles or exceptional metadata use the strict generic fallback.
function boundedPlain(
  value: unknown,
  budget: { left: number; chars?: number },
  ancestors = new Set<object>(),
): boolean {
  budget.chars ??= 262144;

  if (typeof value === "string") {
    budget.chars -= value.length;
    budget.left -= Math.ceil(value.length / 16);

    if (value.length > 65536) return false;
  }

  if (--budget.left < 0 || budget.chars < 0) return false;

  if (value === null || typeof value !== "object")
    return typeof value !== "function" && typeof value !== "symbol";

  if (ancestors.has(value) || (Array.isArray(value) && value.length > 100000))
    return false;

  const prototype = Object.getPrototypeOf(value);

  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  )
    return false;

  ancestors.add(value);

  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;

    budget.chars -= key.length;
    budget.left -= Math.ceil(key.length / 16);

    if (budget.chars < 0) return false;

    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;

    if (
      !("value" in descriptor) ||
      !boundedPlain(descriptor.value, budget, ancestors)
    )
      return false;
  }

  ancestors.delete(value);

  return true;
}

function ownCopy(value: Record<string, unknown>, omitted: string[]) {
  const result: Record<string, unknown> = Object.create(
    Object.getPrototypeOf(value),
  ) as Record<string, unknown>;

  let keys = 0;

  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;

    if (++keys > 50000 || key.length > 65536)
      throw new Error("Unsupported owned record keys");

    if (!omitted.includes(key))
      Object.defineProperty(
        result,
        key,
        Object.getOwnPropertyDescriptor(value, key)!,
      );
  }

  return result;
}

function metadata(value: unknown, omitted: string[], budget = 50000) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Unsupported owned record");

  const result = ownCopy(value as Record<string, unknown>, omitted);

  const remaining = { left: budget, chars: 262144 };

  if (!boundedPlain(result, remaining))
    throw new Error("Unsupported owned record metadata");

  return {
    value: result,
    work: budget - remaining.left,
    characters: 262144 - remaining.chars,
  };
}

function estimateVertices(value: unknown): number {
  if (!Array.isArray(value)) return 0;

  if (value.length && !Array.isArray(value[0])) return 1;

  return value.reduce(
    (sum: number, part: unknown) => sum + estimateVertices(part),
    0,
  );
}

async function send(
  value: unknown,
  credit: CreditWindow,
  post: (packet: OwnedRecordPacket) => void,
  checkpoint: () => Promise<void>,
) {
  const root = metadata(value, ["items", "strokes", "assets"], 4096).value;
  const raw = value as Record<string, unknown>;
  const modern = root.schemaVersion === 4 || root.schemaVersion === 5;
  const key = modern ? "items" : "strokes";

  const items = raw[key],
    assets = modern ? raw.assets : [];

  if (
    !Object.hasOwn(raw, key) ||
    !Array.isArray(items) ||
    items.length > 20000 ||
    !Array.isArray(assets) ||
    assets.length > 128 ||
    (modern && !Object.hasOwn(raw, "assets"))
  )
    throw new Error("Unsupported owned record collection");

  await credit.send((seq) =>
    post({
      type: "raw-start",
      id: 1,
      seq,
      root,
      key,
      length: items.length,
      assets: assets.length,
    }),
  );

  let entries: Array<{
    index: number;
    value: Record<string, unknown>;
    points?: number;
  }> = [];

  let vertices = 0;

  let metadataWork = 0,
    metadataCharacters = 0;

  let values: unknown[] = [];

  let ranges: Array<{
    index: number;
    offset: number;
    start: number;
    count: number;
  }> = [];

  const flushItems = async () => {
    if (!entries.length) return;

    const batch = entries;

    await credit.send((seq) =>
      post({ type: "raw-items", id: 1, seq, entries: batch }),
    );

    entries = [];
    vertices = 0;
    metadataWork = 0;
    metadataCharacters = 0;
  };

  const flushPoints = async () => {
    if (!ranges.length) return;

    const batch = values,
      batchRanges = ranges;

    await credit.send((seq) =>
      post({
        type: "raw-points",
        id: 1,
        seq,
        ranges: batchRanges,
        values: batch,
      }),
    );

    values = [];
    ranges = [];
  };

  for (let index = 0; index < items.length; index++) {
    if (!Object.hasOwn(items, index)) continue;

    const item = items[index] as unknown;
    const preparedEntry = metadata(item, ["points"]);
    const entry = preparedEntry.value;

    const points = Object.hasOwn(item as object, "points")
      ? (item as Record<string, unknown>).points
      : undefined;

    const hasPoints = Object.hasOwn(item as object, "points");

    if (hasPoints && (!Array.isArray(points) || points.length > 100000))
      throw new Error("Unsupported owned points");

    const countVertices = estimateVertices(entry.clip);

    if (
      entries.length &&
      (vertices + countVertices > 2048 ||
        metadataWork + preparedEntry.work > 50000 ||
        metadataCharacters + preparedEntry.characters > 262144)
    )
      await flushItems();

    entries.push({
      index,
      value: entry,
      ...(hasPoints ? { points: (points as unknown[]).length } : {}),
    });

    vertices += countVertices;
    metadataWork += preparedEntry.work;
    metadataCharacters += preparedEntry.characters;

    if (entries.length === 64 || vertices >= 2048) await flushItems();

    if (Array.isArray(points)) {
      let offset = 0;

      while (offset < points.length) {
        const count = Math.min(2048 - values.length, points.length - offset);
        const chunk: unknown[] = points.slice(offset, offset + count);

        for (let i = 0; i < chunk.length; i++)
          if (!Object.hasOwn(points, offset + i)) delete chunk[i];

        if (!boundedPlain(chunk, { left: 50000 }))
          throw new Error("Unsupported owned raw points");

        const start = values.length;

        values.length += count;

        for (let i = 0; i < count; i++)
          if (Object.hasOwn(chunk, i)) values[start + i] = chunk[i];

        ranges.push({ index, offset, start, count });
        offset += count;

        if (values.length === 2048 || ranges.length === 64) await flushPoints();

        await checkpoint();
      }
    }

    await checkpoint();
  }

  await flushItems();
  await flushPoints();

  for (let index = 0; index < assets.length; index++) {
    if (!Object.hasOwn(assets, index)) continue;

    const asset = metadata(assets[index], ["base64"], 4096).value;
    const original = assets[index] as Record<string, unknown>;

    if (
      !Object.hasOwn(original, "base64") ||
      typeof original.base64 !== "string"
    )
      throw new Error("Unsupported owned asset");

    const base64 = original.base64;

    await credit.send((seq) =>
      post({ type: "raw-asset", id: 1, seq, index, value: asset }),
    );

    for (let offset = 0; offset < base64.length; offset += 65536) {
      await credit.send((seq) =>
        post({
          type: "raw-bytes",
          id: 1,
          seq,
          index,
          value: base64.slice(offset, offset + 65536),
        }),
      );

      await checkpoint();
    }
  }

  await credit.drain();
  post({ type: "raw-finish", id: 1 });
}

export const OwnedRecordTransfer = { send };
