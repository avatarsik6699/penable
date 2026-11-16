import { Messages } from "~/shared/lib/messages";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BoardConstants,
  BoardRegions,
  BoardSelection,
  StrokeHistory,
  type BoardItem,
} from "~/entities/board";
import {
  DocumentJobs,
  FragmentCodec,
  FragmentReader,
} from "~/features/board-document";
import { BoardPNG } from "../rendering";
import { BitmapCache } from "../images";
import { BoardClipboard } from "./board-clipboard";

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
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function setup(
  writable: boolean | (() => boolean) = true,
  validate: () => void | Promise<void> = () => {},
  allowed: () => boolean = () => true,
) {
  const canWrite = typeof writable === "function" ? writable : () => writable;

  vi.stubGlobal("window", new EventTarget());

  const data: Record<string, Blob | Promise<Blob>>[] = [];

  vi.stubGlobal(
    "ClipboardItem",
    class {
      constructor(value: Record<string, Blob | Promise<Blob>>) {
        data.push(value);
      }
    },
  );

  const write = vi.fn(async () => {}),
    read = vi.fn(async () => [] as ClipboardItem[]);

  vi.stubGlobal("navigator", { clipboard: { write, read } });

  vi.spyOn(DocumentJobs.prototype, "fragment").mockResolvedValue(
    new Blob(["fragment"]),
  );

  vi.spyOn(BoardPNG, "fragmentPNG").mockResolvedValue(
    new Blob(["png"], { type: "image/png" }),
  );

  const scene = { strokes: [ink], active: null },
    history = new StrokeHistory(scene.strokes, 1);

  const selection = new BoardSelection({
    scene,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    writable: canWrite,
    validate,

    commit: (items) => {
      history.replace(items);
    },

    preview: () => {},

    changed: () => {},

    setViewport: () => {},
  });

  selection.all();

  const insertImage = vi.fn(async () => {}),
    cache = new BitmapCache();

  const canvas = Object.assign(new EventTarget(), { closest: () => null });

  const clipboard = new BoardClipboard({
    canvas: canvas as unknown as HTMLCanvasElement,
    selection,
    images: cache,
    allowed,
    writable: canWrite,
    insertImage,

    activate: () => {},

    changed: () => {},
  });

  return {
    clipboard,
    canvas,
    selection,
    scene,
    history,
    write,
    read,
    data,
    insertImage,
    cache,
  };
}

function dispatchPaste(
  h: ReturnType<typeof setup>,
  types = ["image/png"],
  getAsFile = vi.fn(),
) {
  vi.stubGlobal("Element", EventTarget);
  vi.stubGlobal("document", { body: h.canvas });

  const event = Object.assign(new Event("paste", { cancelable: true }), {
    clipboardData: {
      types,
      items: [{ kind: "file", type: "image/png", getAsFile }],
    },
  });

  Object.defineProperty(event, "target", { value: h.canvas });
  window.dispatchEvent(event);

  return event;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("unified system clipboard ownership", () => {
  it("calls the native write API synchronously with deferred PNG and editable data in one item", async () => {
    const h = setup(),
      png = deferred<Blob>();

    vi.mocked(BoardPNG.fragmentPNG).mockReturnValue(png.promise);

    const copying = h.clipboard.copy(false);

    expect(h.write).toHaveBeenCalledOnce();
    expect(h.data[0]!["image/png"]).toBe(png.promise);
    png.resolve(new Blob(["png"], { type: "image/png" }));
    await copying;
    h.clipboard.dispose();
  });

  it("preserves source on unsupported custom-format construction without an unhandled deferred job", async () => {
    const h = setup();

    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor() {
          throw new Error("unsupported");
        }
      },
    );

    await h.clipboard.copy(true);
    expect(h.write).not.toHaveBeenCalled();
    expect(h.scene.strokes).toEqual([ink]);
    expect(h.history.canUndo).toBe(false);
    h.clipboard.dispose();
  });

  it("writes editable and PNG representations together, then makes cut one undoable edit", async () => {
    const h = setup();

    await h.clipboard.copy(true);
    expect(h.data).toHaveLength(1);
    expect(Object.keys(h.data[0]!)).toEqual([FragmentCodec.MIME, "image/png"]);
    expect(h.scene.strokes).toEqual([]);
    expect(h.history.canUndo).toBe(true);
    h.history.undo();
    expect(h.scene.strokes).toEqual([ink]);
    h.clipboard.dispose();
    h.cache.dispose();
  });

  it("preserves cut on denied writes and read-only still permits copy", async () => {
    const h = setup();

    h.write.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await h.clipboard.copy(true);
    expect(h.scene.strokes).toEqual([ink]);
    expect(h.history.canUndo).toBe(false);

    expect(Messages.plain(h.selection.message)).toContain(
      "Исходные записи сохранены",
    );

    h.clipboard.dispose();

    const readOnly = setup(false);

    await readOnly.clipboard.copy(true);
    expect(readOnly.write).not.toHaveBeenCalled();
    await readOnly.clipboard.copy(false);
    expect(readOnly.write).toHaveBeenCalledOnce();
    readOnly.clipboard.dispose();
  });

  it("does not remove a changed selection after a delayed successful write", async () => {
    const h = setup(),
      write = deferred<void>();

    h.write.mockReturnValue(write.promise);

    const pending = h.clipboard.copy(true);

    h.selection.clear();
    h.selection.all();
    write.resolve();
    await pending;
    expect(h.scene.strokes).toEqual([ink]);
    expect(h.history.canUndo).toBe(false);

    expect(Messages.plain(h.selection.message)).toContain(
      "выделение изменились",
    );

    h.clipboard.dispose();
  });

  it("retains the successful copy when removal validation fails", async () => {
    const h = setup(true, () => {
      throw new Error("invalid");
    });

    await h.clipboard.copy(true);
    expect(h.write).toHaveBeenCalledOnce();
    expect(h.scene.strokes).toEqual([ink]);
    expect(h.history.canUndo).toBe(false);

    expect(Messages.plain(h.selection.message)).toContain(
      "Фрагмент скопирован",
    );

    h.clipboard.dispose();
  });

  it("pending and disposed operations cannot double write or remove", async () => {
    const h = setup(),
      write = deferred<void>();

    h.write.mockReturnValue(write.promise);

    const pending = h.clipboard.copy(true);

    await h.clipboard.copy(true);
    h.clipboard.dispose();
    write.resolve();
    await pending;
    expect(h.write).toHaveBeenCalledOnce();
    expect(h.scene.strokes).toEqual([ink]);
  });

  it("prefers editable current content over its PNG and inserts at center with fresh IDs", async () => {
    const h = setup(),
      blob = new Blob(["current"]),
      getType = vi.fn(async () => blob);

    h.read.mockResolvedValue([
      {
        types: ["image/png", FragmentCodec.MIME],
        getType,
      } as unknown as ClipboardItem,
    ]);

    const fragment = {
      strokes: [ink],
      region: BoardRegions.rectangle({ x: -10, y: -10 }, { x: 40, y: 10 }),
    };

    vi.spyOn(FragmentReader, "read").mockResolvedValue(fragment);
    await h.clipboard.paste();
    expect(getType).toHaveBeenCalledWith(FragmentCodec.MIME);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(h.scene.strokes).toHaveLength(2);
    expect(h.scene.strokes[1]!.id).not.toBe(ink.id);
    expect(h.history.canUndo).toBe(true);
    h.clipboard.dispose();
  });

  it("never substitutes stale internal content for text or invalid own format", async () => {
    const h = setup();

    h.selection.copy();
    await h.clipboard.paste();
    expect(h.scene.strokes).toHaveLength(1);

    h.read.mockResolvedValue([
      {
        types: [FragmentCodec.MIME, "image/png"],
        getType: async () => new Blob(["invalid"]),
      } as unknown as ClipboardItem,
    ]);

    vi.spyOn(FragmentReader, "read").mockRejectedValue(
      new Error("Некорректный фрагмент"),
    );

    await h.clipboard.paste();
    expect(h.scene.strokes).toHaveLength(1);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Некорректный");
    h.clipboard.dispose();
  });

  it("does not retry or flatten an invalid acquired own format to the event PNG", async () => {
    const h = setup(),
      getType = vi.fn(async () => new Blob(["invalid own payload"])),
      getAsFile = vi.fn(() => new Blob(["event PNG"], { type: "image/png" }));

    h.read.mockResolvedValue([
      {
        types: [FragmentCodec.MIME, "image/png"],
        getType,
      } as unknown as ClipboardItem,
    ]);

    vi.spyOn(FragmentReader, "read").mockRejectedValue(
      new Error("invalid fragment"),
    );

    dispatchPaste(h, [FragmentCodec.MIME, "image/png"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(h.read).toHaveBeenCalledOnce();
    expect(getType).toHaveBeenCalledOnce();
    expect(getType).toHaveBeenCalledWith(FragmentCodec.MIME);
    expect(getAsFile).not.toHaveBeenCalled();
    expect(h.insertImage).not.toHaveBeenCalled();
    h.clipboard.dispose();
  });

  it("consumes the current external image and permits event fallback only without async read", async () => {
    const h = setup(),
      image = new Blob(["new"], { type: "image/png" });

    h.selection.copy();

    h.read.mockResolvedValue([
      {
        types: ["image/png"],
        getType: async () => image,
      } as unknown as ClipboardItem,
    ]);

    await h.clipboard.paste();
    expect(h.insertImage).toHaveBeenCalledWith(image);
    h.insertImage.mockClear();
    h.read.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    await h.clipboard.paste(image);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Нет доступа");
    vi.stubGlobal("navigator", { clipboard: {} });
    await h.clipboard.paste(image);
    expect(h.insertImage).toHaveBeenCalledOnce();
    h.clipboard.dispose();
  });

  it.each(["read", "getType"] as const)(
    "retries one transient %s acquisition failure using a fresh clipboard snapshot",
    async (failurePoint) => {
      const h = setup(),
        image = new Blob(["fresh image"], { type: "image/png" }),
        eventImage = new Blob(["stale event image"], { type: "image/png" }),
        getAsFile = vi.fn(() => eventImage),
        transient = new DOMException("clipboard changed", "NotReadableError"),
        getType = vi.fn(async () => image);

      if (failurePoint === "read")
        h.read
          .mockRejectedValueOnce(transient)
          .mockResolvedValueOnce([
            { types: ["image/png"], getType } as unknown as ClipboardItem,
          ]);
      else {
        h.read.mockResolvedValue([
          {
            types: ["image/png"],
            getType: vi
              .fn()
              .mockRejectedValueOnce(transient)
              .mockResolvedValue(image),
          } as unknown as ClipboardItem,
        ]);
      }

      dispatchPaste(h, ["Files"], getAsFile);
      await vi.waitFor(() => expect(h.insertImage).toHaveBeenCalledOnce());

      expect(h.read).toHaveBeenCalledTimes(2);
      expect(h.insertImage).toHaveBeenCalledWith(image);
      expect(getAsFile).toHaveBeenCalledOnce();
      expect(h.insertImage).not.toHaveBeenCalledWith(eventImage);
      h.clipboard.dispose();
    },
  );

  it("bounds a failed second acquisition and preserves editable priority on reread", async () => {
    const h = setup(),
      ownBlob = new Blob(["own fragment"]),
      image = new Blob(["fresh png"], { type: "image/png" }),
      getType = vi.fn(async (type: string) =>
        type === FragmentCodec.MIME ? ownBlob : image,
      );

    h.read
      .mockRejectedValueOnce(new DOMException("changed", "InvalidStateError"))
      .mockResolvedValueOnce([
        {
          types: ["image/png", FragmentCodec.MIME],
          getType,
        } as unknown as ClipboardItem,
      ]);

    const event = dispatchPaste(h, [FragmentCodec.MIME, "image/png"]);

    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(event.defaultPrevented).toBe(true);
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(getType).toHaveBeenCalledOnce();
    expect(getType).toHaveBeenCalledWith(FragmentCodec.MIME);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(h.scene.strokes).toHaveLength(1);
    h.clipboard.dispose();

    const failed = setup(),
      eventImage = new Blob(["stale event image"], { type: "image/png" }),
      getAsFile = vi.fn(() => eventImage);

    failed.read.mockRejectedValue(
      new DOMException("still changing", "DataError"),
    );

    dispatchPaste(failed, ["Files"], getAsFile);
    await vi.waitFor(() => expect(failed.clipboard.busy).toBe(false));
    expect(failed.read).toHaveBeenCalledTimes(2);
    expect(getAsFile).toHaveBeenCalledOnce();
    expect(failed.insertImage).not.toHaveBeenCalled();
    failed.clipboard.dispose();
  });

  it.each(["cancel", "permission", "dispose"] as const)(
    "does not retry or insert after a transient failure becomes stale via %s",
    async (staleAction) => {
      let writable = true;

      const h = setup(() => writable),
        firstRead = deferred<ClipboardItem[]>();

      h.read.mockReturnValueOnce(firstRead.promise).mockResolvedValue([]);

      const getAsFile = vi.fn(() => new Blob(["stale"], { type: "image/png" }));

      dispatchPaste(h, ["Files"], getAsFile);

      if (staleAction === "cancel") h.clipboard.cancel();
      else if (staleAction === "permission") {
        writable = false;
        h.clipboard.permissionChanged();
      } else h.clipboard.dispose();

      firstRead.reject(new DOMException("changed", "NotReadableError"));
      await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
      expect(h.read).toHaveBeenCalledOnce();
      expect(h.insertImage).not.toHaveBeenCalled();
      expect(getAsFile).toHaveBeenCalledOnce();
      h.clipboard.dispose();
    },
  );

  it("uses the same-event image when the successful native read is opaque", async () => {
    const h = setup(),
      image = new Blob(["event image"], { type: "image/png" }),
      getAsFile = vi.fn(() => image);

    h.read.mockResolvedValue([
      {
        types: [],
        getType: vi.fn(),
      } as unknown as ClipboardItem,
    ]);

    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.insertImage).toHaveBeenCalledOnce());
    expect(h.read).toHaveBeenCalledOnce();
    expect(getAsFile).toHaveBeenCalledOnce();
    expect(h.insertImage).toHaveBeenCalledWith(image);
    h.clipboard.dispose();
  });

  it("retries a native opaque read without an event File and inserts the fresh PNG", async () => {
    const h = setup(),
      image = new Blob(["fresh PNG"], { type: "image/png" }),
      getAsFile = vi.fn(() => null);

    h.read
      .mockResolvedValueOnce([
        { types: [], getType: vi.fn() } as unknown as ClipboardItem,
      ])
      .mockResolvedValueOnce([
        {
          types: ["image/png"],
          getType: async () => image,
        } as unknown as ClipboardItem,
      ]);

    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.insertImage).toHaveBeenCalledOnce());
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(getAsFile).toHaveBeenCalledOnce();
    expect(h.insertImage).toHaveBeenCalledWith(image);
    h.clipboard.dispose();
  });

  it("bounds repeated opaque native reads without an event File and shows the Ctrl+V hint", async () => {
    const h = setup(),
      getAsFile = vi.fn(() => null);

    h.read.mockResolvedValue([
      { types: [], getType: vi.fn() } as unknown as ClipboardItem,
    ]);

    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Ctrl+V");
    h.clipboard.dispose();
  });

  it("does not use an event image after retrying opaque menu reads, and gives the Ctrl+V hint", async () => {
    const h = setup(),
      image = new Blob(["event image"], { type: "image/png" });

    h.read.mockResolvedValue([
      { types: [], getType: vi.fn() } as unknown as ClipboardItem,
    ]);

    await h.clipboard.paste(image);
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Ctrl+V");
    h.clipboard.dispose();
  });

  it("retries an opaque menu read once and negotiates the fresh PNG representation", async () => {
    const h = setup(),
      image = new Blob(["fresh PNG"], { type: "image/png" });

    h.read
      .mockResolvedValueOnce([
        { types: [], getType: vi.fn() } as unknown as ClipboardItem,
      ])
      .mockResolvedValueOnce([
        {
          types: ["image/png"],
          getType: async () => image,
        } as unknown as ClipboardItem,
      ]);

    await h.clipboard.paste();
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.insertImage).toHaveBeenCalledOnce();
    expect(h.insertImage).toHaveBeenCalledWith(image);
    h.clipboard.dispose();
  });

  it("does not retain an opaque result after the retry exposes unsupported text", async () => {
    const h = setup();

    h.read
      .mockResolvedValueOnce([
        { types: [], getType: vi.fn() } as unknown as ClipboardItem,
      ])
      .mockResolvedValueOnce([
        {
          types: ["text/plain"],
          getType: vi.fn(),
        } as unknown as ClipboardItem,
      ]);

    await h.clipboard.paste();
    expect(h.read).toHaveBeenCalledTimes(2);
    expect(h.insertImage).not.toHaveBeenCalled();

    expect(Messages.plain(h.selection.message)).not.toContain(
      "Чтение буфера недоступно",
    );

    h.clipboard.dispose();
  });

  it("does not retry ordinary empty clipboard results and uses event fallback only without async read", async () => {
    const h = setup(),
      image = new Blob(["event image"], { type: "image/png" }),
      getAsFile = vi.fn(() => image);

    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.insertImage).not.toHaveBeenCalled();
    h.clipboard.dispose();

    const synchronous = setup();

    vi.stubGlobal("navigator", { clipboard: {} });

    const fallbackFile = vi.fn(() => image);

    dispatchPaste(synchronous, ["Files"], fallbackFile);
    expect(fallbackFile).toHaveBeenCalledOnce();

    await vi.waitFor(() =>
      expect(synchronous.insertImage).toHaveBeenCalledOnce(),
    );

    expect(synchronous.insertImage).toHaveBeenCalledWith(image);
    synchronous.clipboard.dispose();
  });

  it("does not flatten an advertised own format when async read hides its types", async () => {
    const h = setup(),
      getAsFile = vi.fn(() => new Blob(["own preview"], { type: "image/png" }));

    h.read.mockResolvedValue([
      { types: [], getType: vi.fn() } as unknown as ClipboardItem,
    ]);

    dispatchPaste(h, [FragmentCodec.MIME, "image/png"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(getAsFile).not.toHaveBeenCalled();
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.insertImage).not.toHaveBeenCalled();

    expect(Messages.plain(h.selection.message)).toContain(
      "редактируемого фрагмента",
    );

    h.clipboard.dispose();
  });

  it("does not flatten an advertised own format to an async image-only item", async () => {
    const h = setup(),
      imageGetType = vi.fn(
        async () => new Blob(["own preview"], { type: "image/png" }),
      ),
      getAsFile = vi.fn(
        () => new Blob(["own event preview"], { type: "image/png" }),
      );

    h.read.mockResolvedValue([
      {
        types: ["image/png"],
        getType: imageGetType,
      } as unknown as ClipboardItem,
    ]);

    dispatchPaste(h, [FragmentCodec.MIME, "image/png"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(imageGetType).not.toHaveBeenCalled();
    expect(getAsFile).not.toHaveBeenCalled();
    expect(h.insertImage).not.toHaveBeenCalled();

    expect(Messages.plain(h.selection.message)).toContain(
      "редактируемого фрагмента",
    );

    h.clipboard.dispose();
  });

  it("retains async external image preference over the captured event snapshot", async () => {
    const h = setup(),
      image = new Blob(["fresh async image"], { type: "image/png" }),
      eventImage = new Blob(["same-event fallback"], { type: "image/png" }),
      getAsFile = vi.fn(() => eventImage);

    h.read.mockResolvedValue([
      {
        types: ["image/png"],
        getType: async () => image,
      } as unknown as ClipboardItem,
    ]);

    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.insertImage).toHaveBeenCalledOnce());
    expect(getAsFile).toHaveBeenCalledOnce();
    expect(h.insertImage).toHaveBeenCalledWith(image);
    expect(h.insertImage).not.toHaveBeenCalledWith(eventImage);
    h.clipboard.dispose();
  });

  it("keeps clipboard denial fail-closed without retrying into the event image", async () => {
    const h = setup(),
      eventImage = new Blob(["event image"], { type: "image/png" }),
      getAsFile = vi.fn(() => eventImage);

    h.read.mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    dispatchPaste(h, ["Files"], getAsFile);
    await vi.waitFor(() => expect(h.clipboard.busy).toBe(false));
    expect(h.read).toHaveBeenCalledOnce();
    expect(getAsFile).toHaveBeenCalledOnce();
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Нет доступа");
    h.clipboard.dispose();
  });

  it.each([FragmentCodec.MIME, FragmentCodec.MIME.replace(/^web /, "")])(
    "refuses advertised editable type %s rather than flattening its event PNG without async read",
    (advertised) => {
      const h = setup(),
        image = new Blob(["preview"], { type: "image/png" });

      vi.stubGlobal("navigator", { clipboard: {} });
      vi.stubGlobal("Element", EventTarget);
      vi.stubGlobal("document", { body: h.canvas });

      const event = Object.assign(new Event("paste", { cancelable: true }), {
        clipboardData: {
          types: [advertised, "image/png"],
          items: [{ kind: "file", type: "image/png", getAsFile: () => image }],
        },
      });

      Object.defineProperty(event, "target", { value: h.canvas });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(h.insertImage).not.toHaveBeenCalled();
      expect(h.scene.strokes).toEqual([ink]);
      expect(h.history.canUndo).toBe(false);

      expect(Messages.plain(h.selection.message)).toContain(
        "редактируемого фрагмента",
      );

      h.clipboard.dispose();
    },
  );

  it.each([false, true])(
    "queues one fresh paste behind delayed %s cut, ignoring stale event image",
    async (cut) => {
      const h = setup(),
        written = deferred<void>(),
        stale = new Blob(["old image"], { type: "image/png" });

      h.write.mockReturnValue(written.promise);

      h.read.mockResolvedValue([
        {
          types: [FragmentCodec.MIME],
          getType: async () => new Blob(["new fragment"]),
        } as unknown as ClipboardItem,
      ]);

      vi.spyOn(FragmentReader, "read").mockResolvedValue({
        strokes: [ink],
        region: BoardRegions.rectangle({ x: -10, y: -10 }, { x: 40, y: 10 }),
      });

      const copying = h.clipboard.copy(cut);

      await h.clipboard.paste(stale);
      await h.clipboard.paste(stale);
      expect(h.read).not.toHaveBeenCalled();
      written.resolve();
      await copying;
      expect(h.read).toHaveBeenCalledOnce();
      expect(h.insertImage).not.toHaveBeenCalled();
      expect(h.scene.strokes).toHaveLength(cut ? 1 : 2);
      h.clipboard.dispose();
    },
  );

  it("queues repeated native paste events during deferred cut validation even while ordinary interactions are blocked", async () => {
    const validation = deferred<void>(),
      started = deferred<void>();

    let selection: BoardSelection | null = null;

    const allowed = () => !selection?.busy;

    const h = setup(
      true,
      () => {
        started.resolve();

        return validation.promise;
      },
      allowed,
    );

    selection = h.selection;
    vi.stubGlobal("Element", EventTarget);
    vi.stubGlobal("document", { body: h.canvas });

    h.read.mockImplementation(async () => {
      expect(h.scene.strokes).toHaveLength(0);

      return [
        {
          types: [FragmentCodec.MIME],
          getType: async () => new Blob(["current fragment"]),
        } as unknown as ClipboardItem,
      ];
    });

    vi.spyOn(FragmentReader, "read").mockResolvedValue({
      strokes: [ink],
      region: BoardRegions.rectangle({ x: -10, y: -10 }, { x: 40, y: 10 }),
    });

    const cutting = h.clipboard.copy(true);

    await started.promise;
    expect(allowed()).toBe(false);
    expect(h.scene.strokes).toEqual([ink]);

    const stale = new Blob(["stale event PNG"], { type: "image/png" });

    for (let i = 0; i < 2; i++) {
      const event = Object.assign(new Event("paste", { cancelable: true }), {
        clipboardData: {
          types: ["image/png"],
          items: [{ kind: "file", type: "image/png", getAsFile: () => stale }],
        },
      });

      Object.defineProperty(event, "target", { value: h.canvas });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }

    expect(h.read).not.toHaveBeenCalled();
    validation.resolve();
    await cutting;
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.insertImage).not.toHaveBeenCalled();
    expect(h.scene.strokes).toHaveLength(1);
    h.history.undo();
    expect(h.scene.strokes).toHaveLength(0);
    h.history.undo();
    expect(h.scene.strokes).toEqual([ink]);
    h.clipboard.dispose();
    h.cache.dispose();
  });

  it("drops queued paste after a failed or canceled copy without reading current clipboard", async () => {
    const h = setup(),
      written = deferred<void>();

    h.write.mockReturnValue(written.promise);

    const copying = h.clipboard.copy(false);

    await h.clipboard.paste();
    h.clipboard.cancel();
    written.resolve();
    await copying;
    expect(h.read).not.toHaveBeenCalled();

    expect(Messages.plain(h.selection.message)).toContain(
      "ожидающая вставка отменены",
    );

    h.write.mockRejectedValue(new DOMException("denied", "NotAllowedError"));

    const failing = h.clipboard.copy(false);

    await h.clipboard.paste();
    await failing;
    expect(h.read).not.toHaveBeenCalled();
    expect(Messages.plain(h.selection.message)).toContain("Вставка отменена");
    expect(h.scene.strokes).toEqual([ink]);
    h.clipboard.dispose();
  });

  it("does not queue another paste while a paste itself is pending", async () => {
    const h = setup(),
      read = deferred<ClipboardItem[]>();

    h.read.mockReturnValue(read.promise);

    const reading = h.clipboard.paste();

    await h.clipboard.paste();
    read.resolve([]);
    await reading;
    expect(h.read).toHaveBeenCalledOnce();
    expect(h.scene.strokes).toEqual([ink]);
    h.clipboard.dispose();
  });

  it("cancels delayed paste without insertion and downloads PNG without any previous copy", async () => {
    const h = setup(),
      read = deferred<ClipboardItem[]>();

    h.read.mockReturnValue(read.promise);

    const pending = h.clipboard.paste();

    h.clipboard.cancel();

    read.resolve([
      {
        types: ["image/png"],
        getType: async () => new Blob(),
      } as unknown as ClipboardItem,
    ]);

    await pending;
    expect(h.insertImage).not.toHaveBeenCalled();

    const download = vi
      .spyOn(BoardPNG, "downloadPNG")
      .mockImplementation(() => {});

    await h.clipboard.download();
    expect(download).toHaveBeenCalledOnce();
    expect(h.write).not.toHaveBeenCalled();
    h.clipboard.dispose();
  });
});
