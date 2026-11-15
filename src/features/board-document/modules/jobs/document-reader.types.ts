import type { MessageTypes } from "~/shared/lib/messages";
import type { JobRequest } from "./jobs-protocol";

export type DocumentReadResponse =
  JobRequest | { type: "error"; message: MessageTypes.Value };

export type DocumentReadRequest =
  | { type: "file"; blob: Blob }
  | { type: "stored"; value: unknown }
  | {
      type: "runtime";
      value: import("../../board-document.types").BoardDocument;
    };
