import { BoardRegions } from "./regions";
import type { BoardSnapshot, Stroke } from "./types";
function empty(): BoardSnapshot {
  return {
    strokes: [],
    viewport: { zoom: 1, x: 0, y: 0 },
    background: "blank",
    tools: { width: 3, stabilization: 65 },
  };
}
function clone(document: BoardSnapshot): BoardSnapshot {
  return {
    strokes: document.strokes.map((stroke) => {
      const result: Stroke = {
        id: stroke.id,
        color: stroke.color,
        width: stroke.width,
        points: stroke.points.map((point) => ({
          x: point.x,
          y: point.y,
          pressure: point.pressure,
          time: point.time,
        })),
      };
      if (stroke.stabilization) {
        const profile = stroke.stabilization;
        result.stabilization =
          profile.strength !== undefined
            ? { strength: profile.strength, captureZoom: profile.captureZoom }
            : { mode: profile.mode, captureZoom: profile.captureZoom };
      }
      if (stroke.source !== undefined) result.source = stroke.source;
      if (stroke.translation) result.translation = { ...stroke.translation };
      if (stroke.clip) result.clip = BoardRegions.cloneMask(stroke.clip);
      return result;
    }),
    viewport: {
      zoom: document.viewport.zoom,
      x: document.viewport.x,
      y: document.viewport.y,
    },
    background: document.background,
    tools: {
      width: document.tools.width,
      stabilization: document.tools.stabilization,
    },
  };
}
export const BoardSnapshots = { empty, clone };
