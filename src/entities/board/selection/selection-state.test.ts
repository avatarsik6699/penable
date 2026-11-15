import { describe, it, expect, vi } from "vitest";
import type { BoardItem } from "../board.types";
import { BoardSelection } from "./selection";

function setup(strokes: BoardItem[]) {
  const scene = { strokes: [...strokes], active: null };

  return new BoardSelection({
    scene,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    writable: () => true,

    validate: () => {},

    commit: (items) => {
      scene.strokes = items;
    },

    preview: () => {},

    changed: () => {},

    setViewport: () => {},
  });
}

describe("selection content projection", () => {
  const ink: BoardItem = {
    id: 1,
    width: 2,
    color: "#182230",
    points: [{ x: 20, y: 20, pressure: 0.5, time: 0 }],
  };

  const image: BoardItem = {
    kind: "image",
    id: 2,
    asset: {
      id: "image",
      mime: "image/png",
      width: 100,
      height: 50,
      base64: "",
    },
    matrix: [1, 0, 0, 1, 0, 0],
  };

  it("projects image membership through movement and clearing without materializing transformed items", () => {
    const selection = setup([ink, image]);
    const selected = vi.spyOn(selection, "selected", "get");

    expect(selection.hasImages).toBe(false);
    selection.all();
    expect(selection.hasImages).toBe(true);
    selection.nudge(30, 10);
    expect(selection.hasImages).toBe(true);
    selection.finishNudge();
    selection.transform(200, 100, 30);
    expect(selection.hasImages).toBe(true);
    expect(selected).not.toHaveBeenCalled();
    selection.clear();
    expect(selection.hasImages).toBe(false);
  });

  it("keeps an ink-only selection image-free", () => {
    const selection = setup([ink]);

    selection.all();
    selection.nudge(20, 10);
    expect(selection.hasSelection).toBe(true);
    expect(selection.hasImages).toBe(false);
  });
});
