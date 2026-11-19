import { RecoveryCopy } from "./recovery-copy";
import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { CreditWindow } from "./credit-window";
import { FragmentCodec } from "../fragments";
import { DocumentOverview } from "./modules/overview";
import { DocumentCodec, DocumentSchema } from "../codec";
import { DocumentJobConfig } from "./document-jobs.config";
import { DocumentWorkload } from "./document-workload";
import { DocumentRepositoryAdapter } from "../../adapters/indexeddb";
import { BoardIds } from "~/entities/board";
import { BoardRegions } from "~/entities/board";
import {
  type JobRequest,
  type JobResponse,
  type StrokeMetadata,
  type SelectionResult,
  DocumentProtocol,
} from "./jobs-protocol";
import type {
  BoardDocument,
  DocumentRepository,
  StoredRecord,
} from "../../board-document.types";
import type { BoardItem, Point, ImageAsset } from "~/entities/board";

const host = self as unknown as {
  onmessage: ((event: MessageEvent<JobRequest>) => void) | null;
  postMessage: (message: JobResponse) => void;
};

const geometries = new Map<number, Point[]>();

let pending: Extract<
  JobRequest,
  {
    type: "start";
  }
> | null = null;

let strokes: StrokeMetadata[] = [];
let repository: Promise<DocumentRepository> | null = null;
let invalidated: MessageTypes.Value = "";

function metadata(
  stroke: BoardItem,
): import("./jobs-protocol").FragmentMetadata {
  if (stroke.kind === "image") {
    const { asset: _asset, ...entry } = stroke;

    return entry;
  }

  if (stroke.kind === "template" || stroke.kind === "text") return stroke;

  const { points: _points, ...entry } = stroke;

  return entry;
}

const assets = new Map<string, ImageAsset>();

const assetChunks = new Map<
  string,
  {
    asset: Omit<ImageAsset, "base64">;
    chunks: string[];
    offset: number;
    length: number;
  }
>();

let boardId: string | null = null;
let credit = new CreditWindow();
let previousDocument: BoardDocument | null = null;

function capturedItems(): BoardItem[] {
  return strokes.map((entry) => {
    if (entry.kind === "image")
      return {
        ...entry,
        asset: assets.get(entry.asset.id) ?? { ...entry.asset, base64: "" },
      };

    if (entry.kind === "template" || entry.kind === "text") return entry;

    const { geometry, kind: _kind, ownKind, ...stroke } = entry;

    return {
      ...stroke,
      ...(ownKind ? { kind: "ink" as const } : {}),
      points: geometries.get(geometry)!,
    };
  });
}

async function finish(id: number) {
  const job = pending;

  if (!job || job.id !== id) return;

  try {
    const items = capturedItems();
    const captured = { ...job.root, strokes: items };

    const document =
      job.kind === "export" ||
      job.kind === "raw-export" ||
      (job.kind === "replace" && job.trustedReplacement)
        ? captured
        : DocumentCodec.decodeDocument(
            DocumentCodec.encodeDocument(
              { ...job.root, strokes: items },
              job.kind === "select" || job.kind === "overview",
            ),
            undefined,
            job.kind === "select" || job.kind === "overview",
          );

    let selection: SelectionResult | undefined;

    if (job.kind === "select") {
      if (!job.region)
        throw Messages.error(Messages.create("noSelectionRegionProvided"));

      const points = job.region.points;

      const bounds =
        job.region.shape === "all"
          ? BoardRegions.visibleBounds(document.strokes)
          : null;

      const region =
        job.region.shape === "all"
          ? bounds
            ? BoardRegions.rectangle(
                { x: bounds.left, y: bounds.top },
                { x: bounds.right, y: bounds.bottom },
              )
            : []
          : job.region.shape === "rectangle"
            ? BoardRegions.rectangle(points[0]!, points.at(-1)!)
            : BoardRegions.lasso(points);

      const indices = new Map(
        document.strokes.map((stroke, index) => [stroke, index]),
      );

      const parts =
        job.region.shape === "all"
          ? document.strokes.map((original) => ({
              original,
              selected: original,
              remainder: null,
            }))
          : BoardRegions.selectParts(
              document.strokes,
              region,
              BoardIds.createStrokeIdAllocator(document.strokes),
            );

      selection = {
        region,
        parts: parts.map((part) => ({
          index: indices.get(part.original)!,
          same: part.selected === part.original,
          selected: metadata(part.selected),
          remainder: part.remainder ? metadata(part.remainder) : null,
        })),
      };
    }

    const normalizedPrevious =
      job.kind === "replace" && !job.previousStored
        ? DocumentCodec.cloneDocument(previousDocument!)
        : null;

    if (normalizedPrevious) previousDocument = null;

    let schema6Copy: StoredRecord | void = undefined;

    if (job.kind === "save" || job.kind === "replace") {
      if (invalidated) throw Messages.error(invalidated);

      repository ??= DocumentRepositoryAdapter.openRepository(
        (message) => {
          invalidated = message;
        },
        undefined,
        boardId ?? "main",
      );

      const target = await repository;

      const candidate = {
        ...document,
        schemaVersion: DocumentSchema.current(document.strokes),
      };

      if (job.kind === "replace") {
        if (job.previousStored) {
          if (!target.replaceStored)
            throw Messages.error(Messages.create("documentProcessingFailed"));

          schema6Copy = await target.replaceStored(candidate);
        } else
          schema6Copy = await target.replace(normalizedPrevious, candidate);
      } else schema6Copy = await target.write(candidate);
    }

    if (selection) {
      let batch: SelectionResult["parts"] = [],
        vertices = 0,
        text = 0;

      const flush = async () => {
        if (!batch.length) return;

        const chunk = batch;

        await credit.send((seq) => host.postMessage({ id, seq, chunk }));
        batch = [];
        vertices = 0;
        text = 0;
      };

      for (const part of selection.parts) {
        const count =
          (part.selected.clip
            ? BoardRegions.vertexCount(part.selected.clip)
            : 0) +
          (part.remainder?.clip
            ? BoardRegions.vertexCount(part.remainder.clip)
            : 0);

        const units =
          (part.selected.kind === "text"
            ? DocumentWorkload.textUnits(part.selected)
            : 0) +
          (part.remainder?.kind === "text"
            ? DocumentWorkload.textUnits(part.remainder)
            : 0);

        if (
          vertices + count > DocumentJobConfig.vertexChunk ||
          text + units > DocumentJobConfig.textChunkUnits
        )
          await flush();

        batch.push(part);
        vertices += count;
        text += units;

        if (batch.length >= DocumentJobConfig.metadataChunk) await flush();
      }

      await flush();
      await credit.drain();

      selection.parts = [];
    }

    const used = new Set(
      strokes.flatMap((stroke) =>
        stroke.kind === "ink" ? [stroke.geometry] : [],
      ),
    );

    const usedAssets = new Set(
      strokes.flatMap((stroke) =>
        stroke.kind === "image" ? [stroke.asset.id] : [],
      ),
    );

    for (const key of assets.keys())
      if (!usedAssets.has(key)) assets.delete(key);

    for (const key of geometries.keys())
      if (!used.has(key)) geometries.delete(key);

    const previousCopy =
      job.kind === "replace" && !job.previousStored
        ? RecoveryCopy.serialize({
            exists: true,
            value: normalizedPrevious,
          })
        : undefined;

    pending = null;
    previousDocument = null;
    strokes = [];

    const exported =
      job.kind === "export" ? DocumentCodec.serializeDocument(captured) : null;

    host.postMessage({
      id,
      ...(previousCopy ? { previousCopy } : {}),
      ...(schema6Copy
        ? { beforeSchema6: RecoveryCopy.serialize(schema6Copy) }
        : {}),
      ...(job.kind === "raw-export"
        ? {
            rawExport: new Blob([DocumentCodec.serializeRawBackup(captured)], {
              type: "application/json",
            }),
          }
        : {}),
      ...(exported
        ? {
            exported: {
              blob: new Blob([exported.json], { type: "application/json" }),
              warning: exported.warning,
            },
          }
        : {}),
      ...(selection ? { selection } : {}),
      ...(job.kind === "fragment"
        ? {
            fragment: new Blob(
              [
                FragmentCodec.serialize({
                  strokes: document.strokes,
                  region: job.fragmentRegion ?? [],
                }),
              ],
              { type: "application/x-penable-fragment+json" },
            ),
          }
        : {}),
      ...(job.kind === "overview"
        ? { overview: DocumentOverview.build(document.strokes) }
        : {}),
    });
  } catch (error) {
    pending = null;
    previousDocument = null;
    strokes = [];

    host.postMessage({
      id,
      error:
        error instanceof Error
          ? Messages.from(error)
          : Messages.create("documentProcessingFailed"),
    });
  }
}

host.onmessage = ({ data }) => {
  if (data.type === "ack") {
    if (data.id === pending?.id) {
      try {
        credit.acknowledge(data.seq);
      } catch (error) {
        credit.fail(error);
        pending = null;
        strokes = [];
        host.postMessage({ id: data.id, error: Messages.from(error) });
      }
    }

    return;
  }

  if (data.type === "close") {
    void (async () => {
      try {
        await (await repository)?.close();
        assets.clear();
        geometries.clear();
        assetChunks.clear();
        host.postMessage({ id: data.id });
      } catch (error) {
        host.postMessage({ id: data.id, error: Messages.from(error) });
      }
    })();

    return;
  }

  if (data.type === "start") {
    const target = data.boardId ?? "main";

    if (boardId !== null && boardId !== target) {
      host.postMessage({
        id: data.id,
        error: Messages.create("cannotChangeTheBackgroundSaveBoard"),
      });

      return;
    }

    credit = new CreditWindow();
    previousDocument = null;
    boardId = target;
    pending = data;
    assetChunks.clear();
    strokes = [];

    return;
  }

  if (!pending || data.id !== pending.id) return;

  if (data.type === "replacement-candidate") {
    previousDocument = { ...pending.root, strokes: capturedItems() };
    pending = { ...pending, root: data.root };
    strokes = [];
    geometries.clear();
    assets.clear();
    assetChunks.clear();

    return;
  }

  if (data.type === "asset") {
    let upload = assetChunks.get(data.asset.id);

    if (!upload && data.offset === 0) {
      upload = {
        asset: data.asset,
        chunks: [],
        offset: 0,
        length: data.length,
      };

      assetChunks.set(data.asset.id, upload);
    }

    if (
      !upload ||
      data.length > 12 * 1024 * 1024 ||
      upload.offset !== data.offset ||
      upload.length !== data.length ||
      data.value.length > 65536
    ) {
      host.postMessage({
        id: data.id,
        error: Messages.create("invalidImageTransfer"),
      });

      pending = null;

      return;
    }

    upload.chunks.push(data.value);
    upload.offset += data.value.length;

    if (upload.offset === upload.length) {
      assets.set(data.asset.id, {
        ...upload.asset,
        base64: upload.chunks.join(""),
      });

      assetChunks.delete(data.asset.id);
    }
  }

  if (data.type === "points-batch") {
    for (const range of data.ranges) {
      let points = geometries.get(range.geometry);

      if (!points || points.length !== range.length) {
        points = new Array<Point>(range.length);
        geometries.set(range.geometry, points);
      }

      const chunk = DocumentProtocol.pointsFromChunk(
        data.values.subarray(range.start * 4, (range.start + range.count) * 4),
      );

      for (let i = 0; i < chunk.length; i++)
        points[range.offset + i] = chunk[i]!;
    }
  }

  if (data.type === "strokes") strokes.push(...data.values);

  if ("seq" in data) host.postMessage({ id: data.id, ack: data.seq });

  if (data.type === "finish") void finish(data.id);
};
