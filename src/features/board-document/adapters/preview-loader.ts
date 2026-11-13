export const PreviewLoader = {
  load(id: string, signal: AbortSignal): Promise<Blob> {
    if (signal.aborted)
      return Promise.reject(new Error("Предпросмотр отменён."));

    return new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./preview-loader-worker.ts", import.meta.url),
        { type: "module" },
      );

      const finish = () => {
        signal.removeEventListener("abort", abort);
        worker.terminate();
      };

      const abort = () => {
        finish();
        reject(new Error("Предпросмотр отменён."));
      };

      signal.addEventListener("abort", abort, { once: true });

      worker.onerror = (event) => {
        event.preventDefault();
        finish();
        reject(new Error("Предпросмотр недоступен."));
      };

      worker.onmessage = ({
        data,
      }: MessageEvent<{ blob?: Blob; error?: string }>) => {
        finish();

        if (data.blob) resolve(data.blob);
        else reject(new Error(data.error ?? "Предпросмотр недоступен."));
      };

      worker.postMessage(id);
    });
  },
};
