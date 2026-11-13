import { BoardLimits } from "~/entities/board";

const DOCUMENT_LIMITS = {
  bytes: 64 * 1024 * 1024,
  ...BoardLimits.SCENE_LIMITS,
};

const COORDINATE_LIMIT = 1e9;
export const CodecConfig = { COORDINATE_LIMIT, DOCUMENT_LIMITS };
