import { describe, expect, it, vi } from "vitest";
import {
  BoardIds,
  BoardLimits,
  PenInput,
  StrokeHistory,
  type PointerInput,
  type Scene,
  type Stroke,
  BoardConstants,
  BoardViewport,
} from "~/entities/board";
import { DocumentCodec } from "../modules/codec";

function stroke(id: number): Stroke {
  return {
    id,
    color: BoardConstants.INK,
    width: 0.7,
    points: [{ x: 1, y: 2, pressure: 0.5, time: 1 }],
    stabilization: { strength: 65, captureZoom: 1 },
  };
}

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return {
    pointerId: 1,
    pointerType: "pen",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 10,
    clientY: 20,
    pressure: 0.5,
    timeStamp: 1,
    ...overrides,
  };
}

describe("supported stroke ID allocation", () => {
  it("normally increments the maximum and never renumbers loaded objects", () => {
    expect(BoardIds.allocateStrokeId([])).toBe(1);

    const strokes = [stroke(1), stroke(3)];
    const original = strokes[1];

    expect(BoardIds.allocateStrokeId(strokes)).toBe(4);
    expect(strokes.map((ink) => ink.id)).toEqual([1, 3]);
    expect(strokes[1]).toBe(original);
  });

  it("finds the lowest free supported ID at the format ceiling", () => {
    const strokes = [stroke(1), stroke(2), stroke(BoardLimits.MAX_STROKE_ID)];

    expect(BoardIds.allocateStrokeId(strokes)).toBe(3);
    strokes.push(stroke(3));
    expect(BoardIds.allocateStrokeId(strokes)).toBe(4);

    const document = DocumentCodec.emptyDocument();

    document.strokes = strokes;

    expect(
      DocumentCodec.decodeDocument(document).strokes.map((ink) => ink.id),
    ).toEqual([1, 2, BoardLimits.MAX_STROKE_ID, 3]);
  });

  it("keeps new captured IDs importable through cancel, undo, redo and subsequent commits", () => {
    const base = [stroke(1), stroke(2), stroke(BoardLimits.MAX_STROKE_ID)];
    const scene: Scene = { strokes: [...base], active: null };
    const history = new StrokeHistory(scene.strokes, base.length);

    const input = new PenInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: BoardViewport.initialViewport,
      width: () => 0.7,
      allocateId: () => BoardIds.allocateStrokeId(scene.strokes),
      onActiveChange: vi.fn(),
      onCommit: (ink) => history.commit(ink),
    });

    input.down(pointer());
    expect(scene.active?.id).toBe(3);
    input.cancel();
    input.down(pointer());

    const captured = scene.active;

    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 2 }));
    expect(scene.strokes.at(-1)).toBe(captured);
    history.undo();
    input.down(pointer());
    input.cancel();
    expect(history.canRedo).toBe(true);
    history.redo();
    expect(scene.strokes.at(-1)).toBe(captured);
    input.down(pointer());
    expect(scene.active?.id).toBe(4);
    input.up(pointer({ buttons: 0, pressure: 0, timeStamp: 2 }));

    const document = DocumentCodec.emptyDocument();

    document.strokes = scene.strokes;

    expect(
      DocumentCodec.decodeDocument(document).strokes.map((ink) => ink.id),
    ).toEqual([1, 2, BoardLimits.MAX_STROKE_ID, 3, 4]);

    expect(scene.strokes.slice(0, 3)).toEqual(base);
    expect(scene.strokes[2]).toBe(base[2]);
  });
});

describe("batch stroke ID reservation", () => {
  it("reserves unique IDs and wraps through existing gaps at the format ceiling", () => {
    const originals = [
      stroke(1),
      stroke(3),
      stroke(BoardLimits.MAX_STROKE_ID - 1),
    ];

    const allocate = BoardIds.createStrokeIdAllocator(originals);

    expect([allocate(), allocate(), allocate(), allocate()]).toEqual([
      BoardLimits.MAX_STROKE_ID,
      2,
      4,
      5,
    ]);

    expect(originals.map((ink) => ink.id)).toEqual([
      1,
      3,
      BoardLimits.MAX_STROKE_ID - 1,
    ]);
  });

  it("scans input IDs once for an entire batch", () => {
    let reads = 0;

    const originals = Array.from({ length: 100 }, (_, i) => ({
      ...stroke(i + 1),
      get id() {
        reads++;

        return i + 1;
      },
    }));

    const allocate = BoardIds.createStrokeIdAllocator(originals),
      readsAfterSeed = reads;

    expect(Array.from({ length: 100 }, () => allocate())).toEqual(
      Array.from({ length: 100 }, (_, i) => i + 101),
    );

    expect(reads).toBe(readsAfterSeed);
  });
});
