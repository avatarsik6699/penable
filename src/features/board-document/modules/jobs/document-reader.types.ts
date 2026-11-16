import type { MessageTypes } from "~/shared/lib/messages";
import type { JobRequest, TransferAck } from "./jobs-protocol";

export type DocumentReadResponse =
  JobRequest | { type: "error"; message: MessageTypes.Value };

export type DocumentReadRequest =
  | OwnedRecordPacket
  | TransferAck
  | { type: "file"; blob: Blob }
  | { type: "stored"; value: unknown }
  | {
      type: "runtime";
      value: import("../../board-document.types").BoardDocument;
    };

export type OwnedRecordPacket =
  | {
      type: "raw-start";
      id: number;
      seq: number;
      root: Record<string, unknown>;
      key: "items" | "strokes";
      length: number;
      assets: number;
    }
  | {
      type: "raw-items";
      id: number;
      seq: number;
      entries: Array<{
        index: number;
        value: Record<string, unknown>;
        points?: number;
      }>;
    }
  | {
      type: "raw-points";
      id: number;
      seq: number;
      ranges: Array<{
        index: number;
        offset: number;
        start: number;
        count: number;
      }>;
      values: unknown[];
    }
  | {
      type: "raw-asset";
      id: number;
      seq: number;
      index: number;
      value: Record<string, unknown>;
    }
  | { type: "raw-bytes"; id: number; seq: number; index: number; value: string }
  | { type: "raw-finish"; id: number };
