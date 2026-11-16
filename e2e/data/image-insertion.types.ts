export type ImageInsertionFile = {
  name: string;
  mimeType: string;
  base64: string;
  bytes: number;
};

export type ImageWorkerGateState = {
  validateStarts: number;
  validateFinishes: number;
  terminalReplies: number;
  heldReplies: number;
  acknowledgements: number;
  chunks: number;
  jobIds: number[];
  workerCreations: number;
  validationWorkerIds: number[];
  held: boolean;
};

export type ImageWorkerGatePort = {
  arm: () => void;
  release: () => boolean;
  cleanup: () => void;
  state: () => ImageWorkerGateState;
};

export type ImageWorkerGateWindow = Window & {
  __imageInsertion44?: ImageWorkerGatePort;
};
