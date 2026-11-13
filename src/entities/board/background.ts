import type { Viewport } from "./types";
function backgroundLayout(viewport: Viewport) {
  const zoom =
    Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;
  const coarsening = Math.max(0, Math.ceil(Math.log2(12 / (24 * zoom))));
  const worldStep = 24 * 2 ** coarsening;
  const screenStep = worldStep * zoom;
  const phase = (offset: number) =>
    ((offset % screenStep) + screenStep) % screenStep;
  return {
    worldStep,
    screenStep,
    phaseX: phase(viewport.x),
    phaseY: phase(viewport.y),
  };
}

export const BoardBackground = { backgroundLayout };
