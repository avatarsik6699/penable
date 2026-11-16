import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";
import type { OverviewResult } from "./modules/overview";
import type { BoardDocument } from "../../board-document.types";
import type {
  ClipMask,
  Point,
  Stroke,
  ImageItem,
  TemplateItem,
  ImageAsset,
  RegionInput,
} from "~/entities/board";

export type DocumentJobKind =
  | "select"
  | "validate"
  | "save"
  | "overview"
  | "fragment"
  | "export"
  | "replace"
  | "raw-export";

export type FragmentMetadata =
  Omit<Stroke, "points"> | Omit<ImageItem, "asset"> | TemplateItem;

export type StrokeMetadata =
  | TemplateItem
  | (Omit<Stroke, "points"> & {
      kind: "ink";
      geometry: number;
      ownKind?: boolean;
    })
  | (Omit<ImageItem, "asset"> & {
      asset: Omit<ImageAsset, "base64">;
    });

export type SelectionResult = {
  region: ClipMask;
  parts: Array<{
    index: number;
    same: boolean;
    selected: FragmentMetadata;
    remainder: FragmentMetadata | null;
  }>;
};

export type TransferAck = { type: "ack"; id: number; seq: number };

export type JobRequest =
  | TransferAck
  | {
      type: "start";
      id: number;
      kind: DocumentJobKind;
      root: Omit<BoardDocument, "strokes">;
      boardId?: string;
      previousStored?: boolean;
      trustedReplacement?: boolean;
      region?: RegionInput;
      fragmentRegion?: ClipMask;
    }
  | {
      type: "points-batch";
      seq: number;
      ranges: Array<{
        geometry: number;
        length: number;
        offset: number;
        start: number;
        count: number;
      }>;
      id: number;
      values: Float64Array;
    }
  | {
      type: "asset";
      seq: number;
      id: number;
      asset: Omit<ImageAsset, "base64">;
      offset: number;
      length: number;
      value: string;
    }
  | {
      type: "strokes";
      seq: number;
      id: number;
      values: StrokeMetadata[];
    }
  | {
      type: "replacement-candidate";
      id: number;
      root: Omit<BoardDocument, "strokes">;
    }
  | {
      type: "finish";
      id: number;
    }
  | {
      type: "close";
      id: number;
    };

export type JobResponse = {
  id: number;
  ack?: number;
  seq?: number;
  previousCopy?: import("../record-copies").SerializedRecordCopy;
  rawExport?: Blob;
  error?: MessageTypes.Value;
  selection?: SelectionResult;
  overview?: OverviewResult;
  fragment?: Blob;
  exported?: { blob: Blob; warning: MessageTypes.Value };
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
    throw Messages.error(
      Messages.create("theBackgroundWorkerDidNotReturnA226"),
    );

  return value;
}

export const DocumentProtocol = { pointsFromChunk, overviewResult };
