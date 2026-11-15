import type { JobRequest } from "./jobs-protocol";

export type JobUpload = {
  postMessage: (message: JobRequest, transfer: Transferable[]) => void;
};
