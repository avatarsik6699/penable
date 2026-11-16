import { DocumentStorage } from "../modules/jobs";

async function load(id: string, signal: AbortSignal) {
  try {
    return await DocumentStorage.load(id, signal);
  } catch (error) {
    if (
      signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    )
      throw error;

    // Independent startup recovery when module Workers are blocked/unavailable.
    return null;
  }
}

export const DocumentStorageLoader = { load };
