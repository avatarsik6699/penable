import type { OverviewResult } from "./modules/overview";
import type { BoardDocument } from "../../board-document.types";
import type {
  ClipMask,
  Point,
  Stroke,
  ImageItem,
  ImageAsset,
  RegionInput,
} from "~/entities/board";

export type DocumentJobKind =
  "select" | "validate" | "save" | "overview" | "fragment" | "preview";

export type FragmentMetadata =
  Omit<Stroke, "points"> | Omit<ImageItem, "asset">;

export type StrokeMetadata =
  | (Omit<Stroke, "points"> & { kind: "ink"; geometry: number })
  | (Omit<ImageItem, "asset"> & { asset: Omit<ImageAsset, "base64"> });

export type SelectionResult = {
  region: ClipMask;
  parts: Array<{
    index: number;
    same: boolean;
    selected: FragmentMetadata;
    remainder: FragmentMetadata | null;
  }>;
};

export type JobRequest =
  | {
      type: "start";
      id: number;
      kind: DocumentJobKind;
      root: Omit<BoardDocument, "strokes">;
      boardId?: string;
      region?: RegionInput;
      fragmentRegion?: ClipMask;
    }
  | {
      type: "points";
      id: number;
      geometry: number;
      length: number;
      offset: number;
      values: Float64Array;
    }
  | {
      type: "asset";
      id: number;
      asset: Omit<ImageAsset, "base64">;
      offset: number;
      length: number;
      value: string;
    }
  | { type: "strokes"; id: number; values: StrokeMetadata[] }
  | { type: "finish"; id: number }
  | { type: "close"; id: number };

export type JobResponse = {
  id: number;
  error?: string;
  selection?: SelectionResult;
  overview?: OverviewResult;
  fragment?: Blob;
  chunk?: SelectionResult["parts"];
};

function pointsFromChunk(values: Float64Array): Point[] {
  const points: Point[] = [];

  for (let i = 0; i < values.length; i += 4)
    points.push({
      x: values[i]!,
      y: values[i + 1]!,
      pressure: values[i + 2]!,
      time: values[i + 3]!,
    });

  return points;
}

function overviewResult(value: OverviewResult | undefined): OverviewResult {
  const bounds = value?.bounds;

  if (
    !value ||
    value.width !== 256 ||
    value.height !== 160 ||
    !(value.values instanceof Uint8Array) ||
    value.values.length !== 256 * 160 ||
    (bounds !== null &&
      (!bounds ||
        !Number.isFinite(bounds.left) ||
        !Number.isFinite(bounds.right) ||
        !Number.isFinite(bounds.top) ||
        !Number.isFinite(bounds.bottom) ||
        bounds.right <= bounds.left ||
        bounds.bottom <= bounds.top))
  )
    throw new Error("Фоновый поток не вернул корректный обзор.");

  return value;
}

export const DocumentProtocol = { pointsFromChunk, overviewResult };
