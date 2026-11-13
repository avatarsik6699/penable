import type { InputDiagnostics } from "../model/types";
import { BoardCoordinates } from "~/entities/board";
import type { CanvasRenderer } from "./renderer";

function bind(
  canvas: HTMLCanvasElement,
  renderer: CanvasRenderer,
  cancel: () => void,
  resolved: (value: Partial<InputDiagnostics>) => void,
) {
  const visualViewport = window.visualViewport;
  let dprQuery: MediaQueryList | undefined;
  let watchedDpr = -1;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const dpr = BoardCoordinates.validDpr(window.devicePixelRatio);
    const nativeScale = BoardCoordinates.validDpr(visualViewport?.scale ?? 1);

    if (renderer.needsResize(bounds.width, bounds.height, dpr, nativeScale)) {
      cancel();
      renderer.resize(bounds.width, bounds.height, dpr, nativeScale);
    }

    const resolution = renderer.resolution;

    resolved({
      dpr,
      nativeScale,
      requestedRatio: resolution.requestedRatio,
      effectiveRatio: resolution.effectiveRatio,
      bitmapWidth: resolution.width,
      bitmapHeight: resolution.height,
      resolutionCapped: resolution.capped,
    });

    if (watchedDpr !== dpr && typeof window.matchMedia === "function") {
      dprQuery?.removeEventListener("change", resize);
      watchedDpr = dpr;
      dprQuery = window.matchMedia(`(resolution: ${dpr}dppx)`);
      dprQuery.addEventListener("change", resize);
    }
  };

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;

  window.addEventListener("resize", resize);
  visualViewport?.addEventListener("resize", resize);

  if (observer) {
    try {
      // Physical-size observation also wakes resize when only DPR changes.
      const devicePixels =
        typeof ResizeObserverEntry !== "undefined" &&
        "devicePixelContentBoxSize" in ResizeObserverEntry.prototype;

      observer.observe(canvas, {
        box: devicePixels ? "device-pixel-content-box" : "content-box",
      });
    } catch {
      observer.observe(canvas);
    }
  }

  resize();

  return () => {
    window.removeEventListener("resize", resize);
    visualViewport?.removeEventListener("resize", resize);
    observer?.disconnect();
    dprQuery?.removeEventListener("change", resize);
  };
}

export const SurfaceResolution = { bind };
