import type { Viewport } from "../board.types";

function backgroundLayout(viewport: Viewport, spacing = 24) {
  const zoom =
    Number.isFinite(viewport.zoom) && viewport.zoom > 0 ? viewport.zoom : 1;

  const baseStep = Number.isFinite(spacing)
    ? Math.min(64, Math.max(12, spacing))
    : 24;

  const coarsening = Math.max(0, Math.ceil(Math.log2(12 / (baseStep * zoom))));
  const worldStep = baseStep * 2 ** coarsening;
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
