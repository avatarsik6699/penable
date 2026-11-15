import type { MessageTypes } from "~/shared/lib/messages";
import { Messages } from "~/shared/lib/messages";

function render(blob: Blob, signal: AbortSignal): Promise<Blob> {
  if (signal.aborted)
    return Promise.reject(
      Messages.error(Messages.create("imagePreparationCancelled")),
    );

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL("./thumbnail-worker.ts", import.meta.url),
      { type: "module" },
    );

    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };

    const abort = () => {
      finish();
      reject(Messages.error(Messages.create("imagePreparationCancelled")));
    };

    signal.addEventListener("abort", abort, { once: true });

    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(Messages.error(Messages.create("couldNotPrepareTheImage")));
    };

    worker.onmessage = ({
      data,
    }: MessageEvent<{
      blob?: Blob;
      error?: MessageTypes.Value;
    }>) => {
      finish();

      if (data.blob) resolve(data.blob);
      else
        reject(
          Messages.error(
            data.error ?? Messages.create("couldNotPrepareTheImage"),
          ),
        );
    };

    worker.postMessage({ blob });
  });
}

export const RasterJob = { render };
