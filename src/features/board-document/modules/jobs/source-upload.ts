import { DocumentJobConfig } from "./document-jobs.config";
import { BoardRegions, type Stroke } from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";
import type { JobWorker } from "./document-jobs.types";
import type { StrokeMetadata } from "./jobs-protocol";

export class SourceUpload {
  private sourceIDs = new WeakMap<Stroke["points"], number>();
  private known = new Set<number>();
  private nextSource = 0;

  reset() {
    this.known.clear();
    this.sourceIDs = new WeakMap();
    this.nextSource = 0;
  }

  commit(used: Set<number>) {
    this.known = used;
  }

  async send(
    document: BoardDocument,
    worker: JobWorker,
    id: number,
    current: () => void,
    checkpoint: () => Promise<void>,
  ): Promise<Set<number>> {
    const used = new Set<number>(),
      metadata: StrokeMetadata[] = [];

    let vertices = 0;

    const sendMetadata = () => {
      if (metadata.length) {
        worker.postMessage({
          type: "strokes",
          id,
          values: metadata.splice(0),
        });

        vertices = 0;
      }
    };

    for (const stroke of document.strokes) {
      current();

      let geometry = this.sourceIDs.get(stroke.points);

      if (!geometry) {
        geometry = ++this.nextSource;
        this.sourceIDs.set(stroke.points, geometry);
      }

      if (!this.known.has(geometry) && !used.has(geometry)) {
        for (
          let offset = 0;
          offset < stroke.points.length;
          offset += DocumentJobConfig.pointChunk
        ) {
          const count = Math.min(
              DocumentJobConfig.pointChunk,
              stroke.points.length - offset,
            ),
            values = new Float64Array(count * 4);

          for (let i = 0; i < count; i++) {
            const point = stroke.points[offset + i]!;

            values[i * 4] = point.x;
            values[i * 4 + 1] = point.y;
            values[i * 4 + 2] = point.pressure;
            values[i * 4 + 3] = point.time;
          }

          worker.postMessage(
            {
              type: "points",
              id,
              geometry,
              length: stroke.points.length,
              offset,
              values,
            },
            [values.buffer],
          );

          await checkpoint();
        }
      }

      used.add(geometry);

      const { points: _points, ...entry } = stroke;

      metadata.push({ ...entry, geometry });
      vertices += stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0;

      if (
        metadata.length >= DocumentJobConfig.metadataChunk ||
        vertices >= DocumentJobConfig.vertexChunk
      )
        sendMetadata();

      await checkpoint();
    }

    sendMetadata();

    return used;
  }
}
