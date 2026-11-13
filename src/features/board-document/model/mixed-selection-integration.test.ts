import { describe, it, expect } from "vitest";
import {
  BoardSelection,
  BoardRegions,
  StrokeHistory,
  BoardConstants,
  type BoardItem,
  type ImageItem,
  type SelectionPreview,
  type PointerInput,
} from "~/entities/board";
import { DocumentCodec } from "../modules/codec";

const asset = {
  id: "image",
  mime: "image/png" as const,
  width: 100,
  height: 50,
  base64: "",
};

const image: ImageItem = {
  kind: "image",
  id: 2,
  asset,
  matrix: [1, 0, 0, 1, 0, 0],
};

const ink: BoardItem = {
  id: 1,
  width: 2,
  color: BoardConstants.INK,
  points: [{ x: 20, y: 20, pressure: 0.5, time: 0 }],
};

const pointer = (
  x: number,
  y: number,
  extra: Partial<PointerInput> = {},
): PointerInput => ({
  pointerId: 1,
  pointerType: "mouse",
  isPrimary: true,
  button: 0,
  buttons: 1,
  clientX: x,
  clientY: y,
  pressure: 0,
  timeStamp: 0,
  ...extra,
});

function setup(
  items: BoardItem[] = [image, ink],
  validate: () => void | Promise<void> = () => {},
) {
  const scene = { strokes: [...items], active: null },
    history = new StrokeHistory(scene.strokes, items.length);

  let preview: SelectionPreview | null = null;

  const selection = new BoardSelection({
    scene,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    writable: () => true,

    validate,

    commit: (items) => {
      history.replace(items);
    },

    preview: (value) => {
      preview = value;
    },

    changed: () => {},

    setViewport: () => {},
  });

  return { scene, history, selection, preview: () => preview };
}

describe("mixed selection transactions", () => {
  it("previews matrix resize outside canonical scene then commits one undo action", () => {
    const h = setup();

    h.selection.all();
    h.selection.down(pointer(100, 50));
    h.selection.move(pointer(200, 100));
    expect(h.scene.strokes).toEqual([image, ink]);
    expect(h.preview()!.transformed).toBe(true);
    expect(h.history.canUndo).toBe(false);
    h.selection.up(pointer(200, 100, { buttons: 0 }));
    expect(h.history.canUndo).toBe(true);

    expect(h.scene.strokes.map((i) => i.kind ?? "ink")).toEqual([
      "image",
      "ink",
    ]);

    h.history.undo();
    expect(h.scene.strokes[0]).toBe(image);
    expect(h.scene.strokes[1]).toBe(ink);
    expect(h.history.canUndo).toBe(false);
  });

  it("cancel restores exact objects and redo after a transform preview", () => {
    const h = setup();

    h.selection.all();
    h.selection.transform(200, 100, 30);
    h.history.undo();
    h.selection.clear();
    h.selection.all();
    h.selection.down(pointer(100, 50));
    h.selection.move(pointer(150, 70));
    h.selection.cancel();
    expect(h.preview()).toBeNull();
    expect(h.scene.strokes).toEqual([image, ink]);
    expect(h.scene.strokes[0]).toBe(image);
    expect(h.history.canRedo).toBe(true);
  });

  it("crop removes only image remainder and keeps surrounding ink in order with one undo", () => {
    const h = setup([ink, image, { ...ink, id: 3 }]);

    h.selection.down(pointer(30, 10));
    h.selection.up(pointer(70, 40, { buttons: 0 }));
    h.selection.cropImages();
    expect(h.scene.strokes).toHaveLength(3);
    expect(h.scene.strokes[0]).toBe(ink);
    expect(h.scene.strokes[2]!.id).toBe(3);
    expect(h.scene.strokes[1]!.clip).toBeDefined();
    expect((h.scene.strokes[1] as ImageItem).asset).toBe(asset);

    expect(BoardRegions.visibleBounds([h.scene.strokes[1]!])).toEqual({
      left: 30,
      right: 70,
      top: 10,
      bottom: 40,
    });

    h.history.undo();
    expect(h.scene.strokes[1]).toBe(image);
  });

  it("a numeric identity leaves history and redo untouched", () => {
    const h = setup();

    h.selection.all();
    h.selection.transform(200, 100, 0);
    h.history.undo();
    h.selection.clear();
    h.selection.all();
    h.selection.transform(100, 100, 0);
    expect(h.history.canRedo).toBe(true);
    expect(h.history.canUndo).toBe(false);
  });

  it("retains asset identity through portable JSON independent of source index order", () => {
    const headerAsset = {
      ...asset,
      width: 1,
      height: 1,
      base64:
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=",
    };

    const encoded = DocumentCodec.serializeDocument({
      ...DocumentCodec.emptyDocument(),
      strokes: [ink, { ...image, asset: headerAsset }],
    }).json;

    const loaded = DocumentCodec.parseDocumentJSON(encoded);

    expect(loaded.strokes.map((i) => i.id)).toEqual([1, 2]);

    expect((loaded.strokes[1] as ImageItem).asset.base64).toBe(
      headerAsset.base64,
    );
  });
});

it("crop preserves partially selected ink membership for following delete and move", () => {
  const line: BoardItem = {
    id: 1,
    width: 2,
    color: BoardConstants.INK,
    points: [
      { x: 0, y: 25, pressure: 0.5, time: 0 },
      { x: 100, y: 25, pressure: 0.5, time: 1 },
    ],
  };

  for (const action of ["delete", "move"]) {
    const h = setup([line, image]);

    h.selection.down(pointer(30, 10));
    h.selection.up(pointer(70, 40, { buttons: 0 }));
    h.selection.cropImages();

    const selectedInk = h.selection.selected.find(
      (item) => item.kind !== "image",
    )!;

    expect(selectedInk.clip).toBeDefined();

    expect(BoardRegions.visibleBounds([selectedInk])).toMatchObject({
      left: 30,
      right: 70,
    });

    if (action === "delete") h.selection.remove();
    else {
      h.selection.nudge(10, 0);
      h.selection.finishNudge();
    }

    const remaining = h.scene.strokes.filter((item) => item.kind !== "image");

    expect(
      remaining.some((item) =>
        BoardRegions.inkIntersectsMask(
          item,
          BoardRegions.rectangle({ x: 4, y: 24 }, { x: 12, y: 26 }),
        ),
      ),
    ).toBe(true);

    h.history.undo();
    expect(h.scene.strokes[0]).toBe(line);
  }
});

it("finishes a canceled asynchronous insertion once without committing its prepared image", async () => {
  let resolve!: () => void;

  const validation = new Promise<void>((yes) => {
      resolve = yes;
    }),
    h = setup([ink], () => validation),
    pending = h.selection.insertItems([image]);

  expect(h.selection.busy).toBe(true);
  h.selection.cancel();
  await expect(pending).resolves.toBe(false);
  expect(h.selection.busy).toBe(false);
  resolve();
  await validation;
  await Promise.resolve();
  expect(h.scene.strokes).toEqual([ink]);
  expect(h.history.canUndo).toBe(false);
});
