import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoardConstants,
  BoardLimits,
  BoardRegions,
  BoardSnapshots,
  type Stroke,
} from "~/entities/board";
import {
  DocumentCodec,
  DocumentSnapshots,
  FragmentCodec,
  FragmentReader,
  ImageAssets,
} from "~/features/board-document";
import { EditorRuntime } from "./editor-runtime";
import type { SurfaceElements } from "./editor-runtime.types";
import type { WritingSurfaceTypes } from "../writing-surface.types";

// Keep editor/input/clipboard/selection composition real; this node test replaces
// only painting and canvas resolution, which do not own scene mutations.
vi.mock("./rendering", async (importOriginal) => {
  const original = await importOriginal<typeof import("./rendering")>();

  return {
    ...original,
    CanvasRenderer: class {
      setTheme = vi.fn();
      setViewport = vi.fn();
      sceneChanged = vi.fn();
      activeChanged = vi.fn();
      commit = vi.fn();
      setSelectionPreview = vi.fn();
      setTemplatePreview = vi.fn();
      dispose = vi.fn();
    },
    SurfaceResolution: { bind: () => () => {} },
    SurfacePresenters: { background: vi.fn(), selection: vi.fn() },
  };
});

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

const ink: Stroke = {
  id: 1,
  width: 2,
  color: BoardConstants.INK,
  points: [
    { x: 0, y: 0, pressure: 0.5, time: 0 },
    { x: 30, y: 0, pressure: 0.5, time: 1 },
  ],
};

function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((yes) => {
    resolve = yes;
  });

  return { promise, resolve };
}

function setup(
  initialDocument = DocumentSnapshots.toSnapshot(DocumentCodec.emptyDocument()),
) {
  class NativeElement extends EventTarget {
    closest = () => null;

    setAttribute = vi.fn();
    remove = vi.fn();
    click = vi.fn();
    focus = vi.fn();
    dataset = {};

    getContext = () => ({});

    getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
    });
  }

  vi.stubGlobal("Element", NativeElement);
  vi.stubGlobal("HTMLElement", NativeElement);
  vi.stubGlobal("PointerEvent", class extends Event {});

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );

  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  const nativeInput = Object.assign(new NativeElement(), {
    files: [] as Blob[],
  });

  const canvas = new NativeElement();

  const document = Object.assign(new EventTarget(), {
    body: Object.assign(new NativeElement(), { append: vi.fn() }),
    createElement: () => nativeInput,
    elementFromPoint: () => canvas,
    visibilityState: "visible",
  });

  vi.stubGlobal("document", document);

  vi.stubGlobal(
    "window",
    Object.assign(new EventTarget(), { devicePixelRatio: 1 }),
  );

  const read = vi.fn(async () => [
    {
      types: [FragmentCodec.MIME],
      getType: async () =>
        new Blob([
          FragmentCodec.serialize({
            strokes: [ink],
            region: BoardRegions.rectangle(
              { x: -10, y: -10 },
              { x: 40, y: 10 },
            ),
          }),
        ]),
    },
  ]);

  vi.stubGlobal("navigator", { clipboard: { read } });

  // The platform fragment Worker is unavailable in node; retain its strict codec.
  vi.spyOn(FragmentReader, "read").mockImplementation(async (blob) =>
    FragmentCodec.parse(await blob.text()),
  );

  const controlsRef: WritingSurfaceTypes.Props["controlsRef"] = {
    current: null,
  };

  const onSelectionState = vi.fn();
  const onDocumentChange = vi.fn();

  const props: WritingSurfaceTypes.Props = {
    initialDocument,
    clipboard: { strokes: [] },
    tool: "pen",
    getTool: () => "pen",
    canWrite: () => true,
    interactionsBlocked: () => false,
    width: 3,
    stabilization: 0,
    background: "blank",
    backgroundSettings: { contrast: 45, spacing: 24 },
    lastWritingView: null,
    minimapOpen: false,
    modalOpen: false,
    uiRevision: 0,
    controlsRef,
    onSelectionState,
    onDocumentChange,
    onActivateSelection: vi.fn(),
    onNavigationNotice: vi.fn(),
    onScenePresence: vi.fn(),
    onWritingCommitted: vi.fn(),
    onMinimapClose: vi.fn(),
    bindMinimapRoot: vi.fn(),
    onHistoryState: vi.fn(),
    onDiagnostics: vi.fn(),
    onUnavailable: vi.fn(),
  };

  const runtime = EditorRuntime.create(
    { canvas, completed: new NativeElement() } as unknown as SurfaceElements,
    () => props,
  );

  const controls = controlsRef.current!;

  const paste = () => {
    const event = Object.assign(new Event("paste", { cancelable: true }), {
      clipboardData: { types: [FragmentCodec.MIME], items: [] },
    });

    Object.defineProperty(event, "target", { value: canvas });
    window.dispatchEvent(event);

    return event;
  };

  return {
    runtime,
    canvas,
    controls,
    nativeInput,
    read,
    paste,
    onSelectionState,
    onDocumentChange,
    props,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("editor hydration", () => {
  it("opens a million completed samples without copying or visiting them", () => {
    const limits = BoardLimits.SCENE_LIMITS;
    let pointReads = 0;

    const strokes: Stroke[] = Array.from(
      { length: limits.points / limits.pointsPerStroke },
      (_, index) => {
        const samples = Array.from(
          { length: limits.pointsPerStroke },
          (_, offset) => ({ x: offset, y: index, pressure: 0.5, time: offset }),
        );

        const points = new Proxy(samples, {
          get(target, property, receiver) {
            if (typeof property === "string" && /^\d+$/.test(property))
              pointReads++;

            return Reflect.get(target, property, receiver);
          },
        });

        return { ...ink, id: index + 1, points };
      },
    );

    const initial = { ...BoardSnapshots.empty(), strokes };
    const h = setup(initial);

    try {
      const live = h.controls.snapshot();

      expect(pointReads).toBe(0);
      expect(live.strokes).not.toBe(strokes);
      expect(live.viewport).not.toBe(initial.viewport);
      expect(live.strokes).toHaveLength(strokes.length);

      expect(
        live.strokes.every(
          (item, index) =>
            "points" in item && item.points === strokes[index]?.points,
        ),
      ).toBe(true);

      const sample = {
        pointerId: 5,
        pointerType: "pen",
        isPrimary: true,
        button: 0,
        clientY: 10,
        pressure: 0.5,
      };

      h.canvas.dispatchEvent(
        Object.assign(new PointerEvent("pointerdown"), sample, {
          clientX: 10,
          buttons: 1,
        }),
      );

      window.dispatchEvent(
        Object.assign(new PointerEvent("pointerup"), sample, {
          clientX: 20,
          buttons: 0,
        }),
      );

      const added = h.controls.snapshot().strokes.at(-1)!;

      expect(h.controls.snapshot().strokes).toHaveLength(strokes.length + 1);

      expect(added).toMatchObject({
        id: strokes.length + 1,
        points: [{ x: 10 }, { x: 20 }],
      });

      h.controls.undo();
      expect(h.controls.snapshot().strokes).toHaveLength(strokes.length);
      h.controls.redo();
      expect(h.controls.snapshot().strokes.at(-1)).toBe(added);
      expect(initial.strokes).toHaveLength(10);
      expect(pointReads).toBe(0);
    } finally {
      h.runtime.dispose();
    }
  });

  it("keeps the initial board intact through selection transforms, deletion and history", () => {
    const untouched = { ...ink, translation: { x: 6, y: 4 } };

    const source = {
      ...ink,
      points: ink.points.map((point) => Object.freeze({ ...point })),
      translation: { x: 6, y: 4 },
    };

    Object.freeze(source.points);
    Object.freeze(source.translation);
    Object.freeze(source);

    const initial = { ...BoardSnapshots.empty(), strokes: [source] };

    Object.freeze(initial.strokes);

    const h = setup(initial);

    try {
      const completed = h.controls.snapshot().strokes[0];

      h.controls.zoomIn();
      expect(h.controls.snapshot().viewport.zoom).toBe(2);
      expect(initial.viewport).toEqual({ x: 0, y: 0, zoom: 1 });

      h.controls.selection("all");
      h.controls.transform!(150, 100, 0);

      const transformed = h.controls.snapshot().strokes[0];

      expect(transformed).not.toBe(completed);
      expect(transformed).toMatchObject({ matrix: [1.5, 0, 0, 1, -1.5, 4] });
      expect((transformed as Stroke).points).toBe(source.points);

      h.controls.selection("delete");
      expect(h.controls.snapshot().strokes).toHaveLength(0);
      h.controls.undo();
      expect(h.controls.snapshot().strokes[0]).toBe(transformed);
      h.controls.undo();
      expect(h.controls.snapshot().strokes[0]).toBe(completed);
      h.controls.redo();
      expect(h.controls.snapshot().strokes[0]).toBe(transformed);
      expect(initial.strokes).toEqual([untouched]);
    } finally {
      h.runtime.dispose();
    }
  });
});

describe("runtime image and native clipboard command admission", () => {
  it("keeps a toolbar image as the sole insertion during delayed decode and permits editable paste afterwards", async () => {
    const started = deferred<void>();
    const decoded = deferred<ImageBitmap>();
    const close = vi.fn();

    vi.stubGlobal("createImageBitmap", () => {
      started.resolve();

      return decoded.promise;
    });

    const h = setup();

    try {
      h.controls.insertImage!();

      h.nativeInput.files = [
        new Blob([ImageAssets.decodeBase64(base64) as BlobPart], {
          type: "image/png",
        }),
      ];

      h.nativeInput.dispatchEvent(new Event("change"));
      await started.promise;
      expect(h.controls.isBusy()).toBe(true);

      const competing = h.paste();

      // Drain the native event's clipboard/fragment promise chain while decode is held.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      const duringDecode = [...h.controls.snapshot().strokes];

      decoded.resolve({ width: 1, height: 1, close } as unknown as ImageBitmap);
      await vi.waitFor(() => expect(h.controls.isBusy()).toBe(false));
      expect.soft(competing.defaultPrevented).toBe(false);
      expect.soft(duringDecode).toEqual([]);
      expect.soft(h.read).not.toHaveBeenCalled();

      const inserted = h.controls.snapshot().strokes;

      expect(inserted).toHaveLength(1);
      expect(inserted[0]).toMatchObject({ kind: "image", asset: { base64 } });

      expect(h.onSelectionState.mock.calls.at(-1)![0].insertion.phase).toBe(
        "success",
      );

      expect(h.onDocumentChange).toHaveBeenCalledTimes(1);

      const legacy = h.paste();

      expect(legacy.defaultPrevented).toBe(true);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));

      expect(h.onSelectionState.mock.calls.at(-1)![0].message).toEqual({
        code: "fragmentPasted",
      });

      expect(h.controls.snapshot().strokes).toHaveLength(2);
      expect(h.read).toHaveBeenCalledOnce();

      const final = h.controls.snapshot().strokes;

      expect(final[0]).toBe(inserted[0]);
      expect(final[1]).toMatchObject({ points: ink.points });
      expect(new Set(final.map((item) => item.id)).size).toBe(2);
      expect(h.onDocumentChange).toHaveBeenCalledTimes(2);
    } finally {
      h.runtime.dispose();
    }

    expect(close).toHaveBeenCalledOnce();
  });
});
