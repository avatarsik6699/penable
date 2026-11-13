function render(
  blob: Blob,
  mode: "selection" | "thumbnail",
  signal: AbortSignal,
): Promise<Blob> {
  if (signal.aborted)
    return Promise.reject(new Error("Подготовка изображения отменена."));

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
      reject(new Error("Подготовка изображения отменена."));
    };

    signal.addEventListener("abort", abort, { once: true });

    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(new Error("Не удалось подготовить изображение."));
    };

    worker.onmessage = ({
      data,
    }: MessageEvent<{ blob?: Blob; error?: string }>) => {
      finish();

      if (data.blob) resolve(data.blob);
      else
        reject(new Error(data.error ?? "Не удалось подготовить изображение."));
    };

    worker.postMessage({ blob, mode });
  });
}

export const RasterJob = { render };
