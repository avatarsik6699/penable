import { Messages } from "~/shared/lib/messages";
import { CreditWindow } from "./credit-window";
import { DocumentJobConfig } from "./document-jobs.config";
import { DocumentWorkload } from "./document-workload";
import {
  BoardRegions,
  BoardText,
  type BoardItem,
  type Stroke,
  type ImageAsset,
} from "~/entities/board";
import type { BoardDocument } from "../../board-document.types";
import type { JobUpload } from "./source-upload.types";
import type { StrokeMetadata } from "./jobs-protocol";

export class SourceUpload {
  private sourceIDs = new WeakMap<Stroke["points"], number>();
  private known = new Set<number>();
  private nextSource = 0;
  private knownAssets = new Set<ImageAsset>();
  private uploadedAssets = new Set<ImageAsset>();

  reset() {
    this.known.clear();
    this.knownAssets.clear();
    this.uploadedAssets.clear();
    this.sourceIDs = new WeakMap();
    this.nextSource = 0;
  }

  commit(used: Set<number>, items: readonly BoardItem[] = []) {
    const current = new Set(
      items.flatMap((i) => (i.kind === "image" ? [i.asset] : [])),
    );

    this.knownAssets = new Set(
      [...this.knownAssets].filter((a) => current.has(a)),
    );

    for (const asset of this.uploadedAssets)
      if (current.has(asset)) this.knownAssets.add(asset);

    this.uploadedAssets.clear();
    this.known = used;
  }

  async send(
    document: BoardDocument,
    worker: JobUpload,
    id: number,
    current: () => void,
    checkpoint: () => Promise<void>,
    uploadAssets = true,
    credit: CreditWindow,
  ): Promise<Set<number>> {
    const used = new Set<number>(),
      metadata: StrokeMetadata[] = [];

    let vertices = 0;
    let text = 0;
    let totalTextLength = 0;
    let pointCount = 0;
    let values = new Float64Array(DocumentJobConfig.pointChunk * 4);

    let ranges: Array<{
      geometry: number;
      length: number;
      offset: number;
      start: number;
      count: number;
    }> = [];

    const uploadedAssets = new Set<ImageAsset>();

    const sendPoints = async () => {
      if (!pointCount) return;

      const packed = values.subarray(0, pointCount * 4),
        packedRanges = ranges;

      await credit.send((seq) =>
        worker.postMessage(
          {
            type: "points-batch",
            id,
            seq,
            ranges: packedRanges,
            values: packed,
          },
          [packed.buffer],
        ),
      );

      pointCount = 0;
      ranges = [];
      values = new Float64Array(DocumentJobConfig.pointChunk * 4);
    };

    const sendMetadata = async () => {
      if (metadata.length) {
        const entries = metadata.splice(0);

        await credit.send((seq) =>
          worker.postMessage({ type: "strokes", id, seq, values: entries }, []),
        );

        vertices = 0;
        text = 0;
      }
    };

    const queueMetadata = async (entry: StrokeMetadata, count: number) => {
      const units =
        entry.kind === "text" ? DocumentWorkload.textUnits(entry) : 0;

      if (
        metadata.length &&
        (vertices + count > DocumentJobConfig.vertexChunk ||
          text + units > DocumentJobConfig.textChunkUnits)
      )
        await sendMetadata();

      metadata.push(entry);
      vertices += count;
      text += units;

      if (
        metadata.length >= DocumentJobConfig.metadataChunk ||
        vertices >= DocumentJobConfig.vertexChunk ||
        text >= DocumentJobConfig.textChunkUnits
      )
        await sendMetadata();
    };

    for (const stroke of document.strokes) {
      current();

      if (stroke.kind === "image") {
        const { base64, ...asset } = stroke.asset;

        if (
          uploadAssets &&
          !this.knownAssets.has(stroke.asset) &&
          !uploadedAssets.has(stroke.asset)
        ) {
          for (let offset = 0; offset < base64.length; offset += 65536) {
            await credit.send((seq) =>
              worker.postMessage(
                {
                  type: "asset",
                  id,
                  seq,
                  asset,
                  offset,
                  length: base64.length,
                  value: base64.slice(offset, offset + 65536),
                },
                [],
              ),
            );

            await checkpoint();
          }

          uploadedAssets.add(stroke.asset);
        }

        const { asset: _asset, ...entry } = stroke;

        await queueMetadata(
          { ...entry, asset },
          stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0,
        );

        await checkpoint();
        continue;
      }

      if (stroke.kind === "template" || stroke.kind === "text") {
        if (stroke.kind === "text") {
          totalTextLength += stroke.text.length;

          if (
            stroke.text.length > BoardText.maxLength ||
            stroke.lines.length > BoardText.maxLines ||
            totalTextLength > BoardText.maxBytes
          )
            throw Messages.error(
              Messages.create("invalidDataValue", { p0: "items.text" }),
            );
        }

        await queueMetadata(
          stroke,
          stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0,
        );

        await checkpoint();
        continue;
      }

      let geometry = this.sourceIDs.get(stroke.points);

      if (!geometry) {
        geometry = ++this.nextSource;
        this.sourceIDs.set(stroke.points, geometry);
      }

      if (!this.known.has(geometry) && !used.has(geometry)) {
        let offset = 0;

        while (offset < stroke.points.length) {
          const count = Math.min(
            DocumentJobConfig.pointChunk - pointCount,
            stroke.points.length - offset,
          );

          ranges.push({
            geometry,
            length: stroke.points.length,
            offset,
            start: pointCount,
            count,
          });

          for (let i = 0; i < count; i++) {
            const point = stroke.points[offset + i]!;

            if (
              !point ||
              [point.x, point.y, point.pressure, point.time].some(
                (value) => typeof value !== "number",
              )
            )
              throw new Error("Invalid raw document point");

            const at = (pointCount + i) * 4;

            values[at] = point.x;
            values[at + 1] = point.y;
            values[at + 2] = point.pressure;
            values[at + 3] = point.time;
          }

          pointCount += count;
          offset += count;

          if (
            pointCount === DocumentJobConfig.pointChunk ||
            ranges.length === 64
          )
            await sendPoints();

          await checkpoint();
        }
      }

      used.add(geometry);

      const { points: _points, ...entry } = stroke;

      await queueMetadata(
        {
          ...entry,
          kind: "ink",
          geometry,
          ownKind: Object.hasOwn(stroke, "kind"),
        },
        stroke.clip ? BoardRegions.vertexCount(stroke.clip) : 0,
      );

      await checkpoint();
    }

    await sendPoints();
    await sendMetadata();
    await credit.drain();

    this.uploadedAssets = uploadedAssets;

    return used;
  }
}
