import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardConstants, BoardRegions, type BoardItem } from "~/entities/board";
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
// only painting and canvas resolution, which do not own command admission.
vi.mock("./rendering", async (importOriginal) => {
  const original = await importOriginal<typeof import("./rendering")>();

  return {
    ...original,
    CanvasRenderer: class {
      setTheme = vi.fn();
      sceneChanged = vi.fn();
      activeChanged = vi.fn();
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

const ink: BoardItem = {
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

function setup() {
  class NativeElement extends EventTarget {
    closest = () => null;

    setAttribute = vi.fn();
    remove = vi.fn();
    click = vi.fn();
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

  const initialDocument = DocumentSnapshots.toSnapshot(
    DocumentCodec.emptyDocument(),
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
