import { describe, expect, it, vi } from "vitest";
import {
  EraserInput,
  StrokeHistory,
  type PointerInput,
  type Scene,
  type Stroke,
  type Viewport,
  BoardConstants,
  BoardIds,
  BoardNavigation,
} from "~/entities/board";
import { DocumentCodec } from "./codec";

function stroke(id: number, x: number, y = 0): Stroke {
  return {
    id,
    color: BoardConstants.INK,
    width: 2,
    points: [{ x, y, pressure: 0.5, time: 1 }],
  };
}

function pointer(overrides: Partial<PointerInput> = {}): PointerInput {
  return {
    pointerId: 1,
    pointerType: "pen",
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: 0,
    clientY: 0,
    pressure: 0.5,
    timeStamp: 1,
    ...overrides,
  };
}

function setup(
  strokes = [stroke(1, 0), stroke(2, 50)],
  viewport: Viewport = { x: 0, y: 0, zoom: 1 },
) {
  const scene: Scene = { strokes, active: null };
  const history = new StrokeHistory(scene.strokes, strokes.length);
  const onPreviewChange = vi.fn();

  const onCommit = vi.fn((erased: ReadonlySet<Stroke>) =>
    history.erase(erased),
  );

  const input = new EraserInput({
    scene,
    bounds: () => ({ left: 10, top: 20 }),
    viewport: () => viewport,
    onPreviewChange,
    onCommit,
  });

  const event = (overrides: Partial<PointerInput> = {}) =>
    pointer({ clientX: 10, clientY: 20, ...overrides });

  return { scene, history, input, onPreviewChange, onCommit, event };
}

describe("whole stroke eraser ownership and transactions", () => {
  it.each([
    { pointerType: "touch" },
    { pointerType: "" },
    { isPrimary: false },
    { button: 1, buttons: 4 },
    { button: 2, buttons: 2 },
    { buttons: 0 },
    { buttons: 3 },
    { clientX: NaN },
    { pressure: NaN },
  ])("ignores unsupported contact %j", (overrides) => {
    const { input, event, onPreviewChange, onCommit } = setup();

    expect(input.down(event(overrides))).toBe(false);
    expect(input.pointerId).toBeNull();
    expect(input.preview.size).toBe(0);
    expect(onPreviewChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each(["pen", "mouse"])(
    "previews a %s gesture without changing canonical snapshots; commits all hits once on up",
    (pointerType) => {
      const { scene, history, input, event, onCommit } = setup();
      const originals = [...scene.strokes];
      const document = DocumentCodec.emptyDocument();

      const snapshot = () =>
        DocumentCodec.cloneDocument({ ...document, strokes: scene.strokes });

      input.down(event({ pointerType }));
      expect(input.preview.has(originals[0]!)).toBe(true);
      input.move(event({ clientX: 60 }));
      expect(input.preview.size).toBe(2);
      expect(scene.strokes).toEqual(originals);
      expect(snapshot().strokes).toEqual(originals);

      expect(
        DocumentCodec.decodeDocument(
          JSON.parse(DocumentCodec.serializeDocument(snapshot()).json),
        ).strokes,
      ).toEqual(originals);

      expect(history.canUndo).toBe(false);
      expect(onCommit).not.toHaveBeenCalled();

      expect(input.up(event({ clientX: 60, buttons: 0, pressure: 0 }))).toBe(
        true,
      );

      expect(onCommit).toHaveBeenCalledOnce();
      expect(scene.strokes).toEqual([]);
      expect(input.pointerId).toBeNull();
      expect(input.preview.size).toBe(0);
      history.undo();

      originals.forEach((original, i) =>
        expect(scene.strokes[i]).toBe(original),
      );

      history.redo();
      expect(snapshot().strokes).toEqual([]);
    },
  );

  it("ignores second pointers, unrelated cancellation and wrong-button up", () => {
    const { input, event, onCommit } = setup();

    input.down(event());
    expect(input.down(event({ pointerId: 2 }))).toBe(false);
    expect(input.move(event({ pointerId: 2, clientX: 60 }))).toBe(false);
    expect(input.up(event({ pointerId: 2, buttons: 0 }))).toBe(false);
    expect(input.cancel(2)).toBe(false);
    expect(input.up(event({ button: 2, buttons: 0 }))).toBe(false);
    expect(input.pointerId).toBe(1);
    expect(input.preview.size).toBe(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each(["cancel", "button-loss"] as const)(
    "restores preview on %s without a history/save boundary",
    (reason) => {
      const { input, scene, history, event, onCommit } = setup();
      const originals = [...scene.strokes];

      input.down(event());

      if (reason === "cancel") input.cancel();
      else input.move(event({ clientX: 60, buttons: 0 }));

      expect(input.preview.size).toBe(0);
      expect(input.pointerId).toBeNull();
      expect(scene.strokes).toEqual(originals);
      expect(history.canUndo).toBe(false);
      expect(onCommit).not.toHaveBeenCalled();
      expect(input.up(event({ buttons: 0 }))).toBe(false);
    },
  );

  it("keeps redo after a miss and cancelled preview, and never commits either", () => {
    const { input, history, event, onCommit } = setup();

    history.erase(new Set(history.strokes));
    history.undo();
    input.down(event({ clientX: 1000, clientY: 1000 }));
    input.up(event({ clientX: 1000, clientY: 1000, buttons: 0 }));
    input.down(event());
    input.cancel();
    expect(history.canRedo).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("covers sparse move crossings, coalesced bends and the final pointerup segment", () => {
    const { input, scene, event, onCommit } = setup([
      stroke(1, 50),
      stroke(2, 100, 50),
      stroke(3, 150),
    ]);

    input.down(event({ clientX: 10 }));

    input.move(
      event({
        clientX: 110,
        getCoalescedEvents: () => [
          event({ clientX: 110 }),
          event({ clientX: 110, clientY: 70 }),
          event({ clientX: 110 }),
        ],
      }),
    );

    expect(input.preview.size).toBe(2);

    input.up(
      event({
        clientX: 210,
        buttons: 0,
        getCoalescedEvents: () => [event({ clientX: 110 })],
      }),
    );

    expect(scene.strokes).toEqual([]);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it.each([0.25, 1, 4, 8])(
    "maps pan, surface bounds and zoom %s before hit testing",
    (zoom) => {
      const viewport = { x: -200, y: 150, zoom };
      const { input, event, scene } = setup([stroke(1, 100, 200)], viewport);
      const clientX = 10 + viewport.x + 100 * zoom;
      const clientY = 20 + viewport.y + 200 * zoom + 8 + zoom - 0.1;

      input.down(event({ clientX, clientY }));
      expect(input.preview.size).toBe(1);
      input.up(event({ clientX, clientY, buttons: 0 }));
      expect(scene.strokes).toEqual([]);
    },
  );

  it("does not retain a hidden ID after a completed erase and new allocation", () => {
    const { input, history, scene, event } = setup([stroke(1, 0)]);

    input.down(event());
    input.up(event({ buttons: 0 }));

    const replacement = stroke(BoardIds.allocateStrokeId(scene.strokes), 100);

    expect(replacement.id).toBe(1);
    history.commit(replacement);
    input.down(event());
    expect(input.preview.size).toBe(0);
    input.up(event({ buttons: 0 }));
    expect(scene.strokes[0]).toBe(replacement);
    history.undo();
    history.undo();
    expect(scene.strokes[0]?.points[0]?.x).toBe(0);
  });

  it("blocks own navigation only while the eraser owns a pointer", () => {
    const { input, event } = setup();

    const navigation = new BoardNavigation({
      clock: () => performance.now(),
      viewport: { x: 0, y: 0, zoom: 1 },
      isDrawing: () => input.pointerId !== null,
      onChange: vi.fn(),
    });

    input.down(event());
    expect(navigation.setZoom(2, { x: 0, y: 0 })).toBe(false);
    expect(navigation.startPan(event({ pointerId: 2 }), true)).toBe(false);
    input.cancel();
    expect(navigation.startPan(event(), true)).toBe(true);
    navigation.endPan();

    expect(
      navigation.startPan(
        event({ pointerType: "mouse", button: 1, buttons: 4 }),
        false,
      ),
    ).toBe(true);
  });
});
