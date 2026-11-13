export type JobWorker = Pick<
  Worker,
  "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror"
>;

export type JobOptions = {
  boardId?: string;
  worker?: () => JobWorker;
  yield?: () => Promise<void>;
  now?: () => number;
};
