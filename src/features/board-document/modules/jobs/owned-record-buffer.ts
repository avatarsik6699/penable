import type { OwnedRecordPacket } from "./document-reader.types";

export class OwnedRecordBuffer {
  private root: Record<string, unknown> = {};
  private items: unknown[] = [];
  private assets: unknown[] = [];
  private chunks = new Map<number, string[]>();
  private points = new Map<number, unknown[]>();

  accept(packet: OwnedRecordPacket): unknown {
    if (packet.type === "raw-start") {
      this.root = packet.root;
      this.items = new Array<unknown>(packet.length);
      this.root[packet.key] = this.items;

      if (packet.key === "items") {
        this.assets = new Array<unknown>(packet.assets);
        this.root.assets = this.assets;
      }
    }

    if (packet.type === "raw-items") {
      for (const entry of packet.entries) {
        this.items[entry.index] = entry.value;

        if (entry.points !== undefined) {
          const points = this.points.get(entry.index) ?? [];

          points.length = entry.points;
          this.points.set(entry.index, points);
          entry.value.points = points;
        }
      }
    }

    if (packet.type === "raw-points") {
      for (const range of packet.ranges) {
        const points = this.points.get(range.index) ?? [];

        this.points.set(range.index, points);

        for (let i = 0; i < range.count; i++) {
          if (Object.hasOwn(packet.values, range.start + i))
            points[range.offset + i] = packet.values[range.start + i];
        }
      }
    }

    if (packet.type === "raw-asset") {
      this.assets[packet.index] = packet.value;
      this.chunks.set(packet.index, []);
    }

    if (packet.type === "raw-bytes")
      this.chunks.get(packet.index)!.push(packet.value);

    if (packet.type === "raw-finish") {
      for (const [index, chunks] of this.chunks)
        (this.assets[index] as Record<string, unknown>).base64 =
          chunks.join("");

      return this.root;
    }

    return undefined;
  }
}
