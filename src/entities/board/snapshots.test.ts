import { expect, it } from "vitest";
import { BoardConstants, type Stroke } from "./board.types";
import { BoardRegions } from "./regions";
import { BoardSnapshots } from "./snapshots";

it("still deep clones the mutable state in a board snapshot", () => {
  const original: Stroke = {
    id: 1,
    color: BoardConstants.INK,
    width: 3,
    points: [{ x: 3, y: 6, pressure: 0.5, time: 1 }],
    stabilization: { mode: "light", captureZoom: 1 },
    clip: BoardRegions.rectangle({ x: 2, y: 3 }, { x: 4, y: 7 }),
    translation: { x: 6, y: 4 },
  };

  const snapshot = {
    ...BoardSnapshots.empty(),
    strokes: [original],
    lastWritingView: { center: { x: 6, y: 4 }, zoom: 2 },
  };

  const cloned = BoardSnapshots.clone(snapshot);
  const [copied] = cloned.strokes;

  expect(cloned).toEqual(snapshot);

  const stroke = copied as Stroke;

  stroke.points[0]!.x = 20;
  stroke.clip![0]![0]![0]![0] = 40;
  stroke.translation!.x = 80;
  cloned.viewport.zoom = 2;
  cloned.lastWritingView!.center.x = 20;

  expect(original.points[0]!.x).toBe(3);
  expect(original.clip![0]![0]![0]![0]).toBe(2);
  expect(original.translation!.x).toBe(6);
  expect(snapshot.viewport.zoom).toBe(1);
  expect(snapshot.lastWritingView.center.x).toBe(6);
});
