import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import { FragmentCodec } from "../fragments";
import { DocumentOverview } from "./modules/overview";
import { DocumentCodec } from "../codec";
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
import type { DocumentRepository } from "../../board-document.types";
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

  if (stroke.kind === "template") return stroke;

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

async function finish(id: number) {
  const job = pending;

  if (!job || job.id !== id) return;

  try {
    const items: BoardItem[] = strokes.map((entry) => {
      if (entry.kind === "image")
        return {
          ...entry,
          asset: assets.get(entry.asset.id) ?? { ...entry.asset, base64: "" },
        };

      if (entry.kind === "template") return entry;

      const { geometry, ...stroke } = entry;

      return { ...stroke, points: geometries.get(geometry)! };
    });

    const document = DocumentCodec.decodeDocument(
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

    if (job.kind === "save") {
      if (invalidated) throw Messages.error(invalidated);

      repository ??= DocumentRepositoryAdapter.openRepository(
        (message) => {
          invalidated = message;
        },
        undefined,
        boardId ?? "main",
      );

      await (await repository).write({ ...document, schemaVersion: 5 });
    }

    if (selection) {
      let batch: SelectionResult["parts"] = [],
        vertices = 0;

      for (const part of selection.parts) {
        batch.push(part);

        vertices +=
          (part.selected.clip
            ? BoardRegions.vertexCount(part.selected.clip)
            : 0) +
          (part.remainder?.clip
            ? BoardRegions.vertexCount(part.remainder.clip)
            : 0);

        if (batch.length >= 64 || vertices >= 2048) {
          host.postMessage({ id, chunk: batch });
          batch = [];
          vertices = 0;
        }
      }

      if (batch.length) host.postMessage({ id, chunk: batch });

      selection.parts = [];
    }

    const used = new Set(
      strokes.flatMap((stroke) =>
        stroke.kind === "image" || stroke.kind === "template"
          ? []
          : [stroke.geometry],
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

    pending = null;
    strokes = [];

    host.postMessage({
      id,
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

    boardId = target;
    pending = data;
    assetChunks.clear();
    strokes = [];

    return;
  }

  if (!pending || data.id !== pending.id) return;

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

  if (data.type === "points") {
    let points = geometries.get(data.geometry);

    if (!points || points.length !== data.length) {
      points = new Array<Point>(data.length);
      geometries.set(data.geometry, points);
    }

    const chunk = DocumentProtocol.pointsFromChunk(data.values);

    for (let i = 0; i < chunk.length; i++) points[data.offset + i] = chunk[i]!;
  }

  if (data.type === "strokes") strokes.push(...data.values);

  if (data.type === "finish") void finish(data.id);
};
