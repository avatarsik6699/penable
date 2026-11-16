import type { BoardItem, ImageAsset, Point } from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";
import {
  DocumentProtocol,
  type JobRequest,
  type StrokeMetadata,
} from "./jobs-protocol";

// Only receives the private, validated worker stream. Raw JSON never enters this buffer.
export class DocumentReadBuffer {
  private root: Omit<BoardDocument, "strokes"> | null = null;
  private readonly geometries = new Map<number, Point[]>();
  private readonly assets = new Map<string, ImageAsset>();
  private readonly assetChunks = new Map<string, string[]>();
  private readonly strokes: StrokeMetadata[] = [];

  accept(message: JobRequest): BoardDocument | null {
    if (message.type === "start") this.root = message.root;

    if (message.type === "points-batch") {
      for (const range of message.ranges) {
        let points = this.geometries.get(range.geometry);

        if (!points) {
          points = new Array<Point>(range.length);
          this.geometries.set(range.geometry, points);
        }

        const chunk = DocumentProtocol.pointsFromChunk(
          message.values.subarray(
            range.start * 4,
            (range.start + range.count) * 4,
          ),
        );

        for (let i = 0; i < chunk.length; i++)
          points[range.offset + i] = chunk[i]!;
      }
    }

    if (message.type === "asset") {
      const chunks = this.assetChunks.get(message.asset.id) ?? [];

      chunks.push(message.value);
      this.assetChunks.set(message.asset.id, chunks);

      if (message.offset + message.value.length === message.length) {
        this.assets.set(
          message.asset.id,
          Object.freeze({ ...message.asset, base64: chunks.join("") }),
        );

        this.assetChunks.delete(message.asset.id);
      }
    }

    if (message.type === "strokes") this.strokes.push(...message.values);

    if (message.type !== "finish" || !this.root) return null;

    const strokes: BoardItem[] = this.strokes.map((entry) => {
      if (entry.kind === "image")
        return { ...entry, asset: this.assets.get(entry.asset.id)! };

      if (entry.kind === "template") return entry;

      const { geometry, kind: _kind, ownKind, ...stroke } = entry;

      return {
        ...stroke,
        ...(ownKind ? { kind: "ink" as const } : {}),
        points: this.geometries.get(geometry)!,
      };
    });

    return { ...this.root, strokes };
  }
}
