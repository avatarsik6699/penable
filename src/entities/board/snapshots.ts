import { BoardWriting } from "./writing";
import { BoardRegions } from "./regions";
import type { BoardItem, BoardSnapshot, Stroke } from "./board.types";

function empty(): BoardSnapshot {
  return {
    strokes: [],
    viewport: { zoom: 1, x: 0, y: 0 },
    background: "blank",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    tools: { width: 3, stabilization: 65, writing: BoardWriting.defaults() },
  };
}

function copyItem(stroke: BoardItem, sharePoints: boolean): BoardItem {
  if (stroke.kind === "image" || stroke.kind === "template")
    return {
      ...stroke,
      matrix: [...stroke.matrix],
      clip: stroke.clip ? BoardRegions.cloneMask(stroke.clip) : undefined,
    };

  const result: Stroke = {
    id: stroke.id,
    color: stroke.color,
    ...(stroke.style ? { style: { ...stroke.style } } : {}),
    width: stroke.width,
    points: sharePoints
      ? stroke.points
      : stroke.points.map((point) => ({
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

  if (stroke.matrix) result.matrix = [...stroke.matrix];

  if (stroke.source !== undefined) result.source = stroke.source;

  if (stroke.translation) result.translation = { ...stroke.translation };

  if (stroke.clip) result.clip = BoardRegions.cloneMask(stroke.clip);

  return result;
}

function cloneWritingView(view: BoardSnapshot["lastWritingView"]) {
  return view ? { center: { ...view.center }, zoom: view.zoom } : null;
}

function hydrateEditor(document: BoardSnapshot) {
  return {
    // Edits replace completed items. Pen input appends samples to its own active stroke.
    strokes: document.strokes.map((stroke) => copyItem(stroke, true)),
    viewport: { ...document.viewport },
    lastWritingView: cloneWritingView(document.lastWritingView),
  };
}

function clone(document: BoardSnapshot): BoardSnapshot {
  return {
    strokes: document.strokes.map((stroke) => copyItem(stroke, false)),
    viewport: {
      zoom: document.viewport.zoom,
      x: document.viewport.x,
      y: document.viewport.y,
    },
    background: document.background,
    backgroundSettings: {
      ...(document.backgroundSettings ?? { contrast: 45, spacing: 24 }),
    },
    lastWritingView: cloneWritingView(document.lastWritingView),
    tools: {
      width: document.tools.width,
      stabilization: document.tools.stabilization,
      ...(document.tools.writing
        ? {
            writing: {
              instrument: document.tools.writing.instrument,
              instruments: {
                pen: { ...document.tools.writing.instruments.pen },
                pressure: { ...document.tools.writing.instruments.pressure },
                highlighter: {
                  ...document.tools.writing.instruments.highlighter,
                },
              },
            },
          }
        : {}),
    },
  };
}

export const BoardSnapshots = { empty, clone, hydrateEditor };
