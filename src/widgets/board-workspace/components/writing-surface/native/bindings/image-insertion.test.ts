import { afterEach, describe, expect, it, vi } from "vitest";
import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import { BoardSelection, type Scene } from "~/entities/board";
import { ImageAssets } from "~/features/board-document";
import { BitmapCache, ImageInput } from "../images";
import { PointerBinding } from "./pointer-binding";
import { KeyboardBinding } from "./keyboard-binding";
import type { BindingOptions } from "./surface-bindings.types";

const base64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMZkAAAAASUVORK5CYII=";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;

  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });

  return { promise, resolve, reject };
}

function setup() {
  class NativeElement extends EventTarget {
    closest = () => null;

    setAttribute = vi.fn();
    remove = vi.fn();
  }

  vi.stubGlobal("HTMLElement", NativeElement);

  const nativeInput = new NativeElement();

  const nativeDocument = Object.assign(new EventTarget(), {
    visibilityState: "visible",
    createElement: () => nativeInput,
    body: { append: vi.fn() },
  });

  vi.stubGlobal("document", nativeDocument);

  const canvas = Object.assign(new NativeElement(), {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    hasPointerCapture: () => false,
  });

  const scene: Scene = { strokes: [], active: null };
  const guards = { writable: true, blocked: false };
  const started = deferred<void>();
  const validation = deferred<void>();
  const close = vi.fn();

  vi.stubGlobal("createImageBitmap", async () => ({
    width: 1,
    height: 1,
    close,
  }));

  const validate = vi.fn((_items: Scene["strokes"], _signal: AbortSignal) => {
    started.resolve();

    return validation.promise;
  });

  const commit = vi.fn((items: Scene["strokes"]) => {
    scene.strokes = items;
  });

  const selection = new BoardSelection({
    scene,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    bounds: canvas.getBoundingClientRect,
    writable: () => guards.writable,
    validate,
    commit,
    preview: vi.fn(),
    changed: vi.fn(),
    setViewport: vi.fn(),
  });

  const images = new BitmapCache();
  const notice = vi.fn();

  const image = new ImageInput({
    canvas: canvas as unknown as HTMLCanvasElement,
    scene,
    images,
    viewport: () => ({ x: 0, y: 0, zoom: 1 }),
    allowed: () => guards.writable && !guards.blocked && !selection.busy,
    insert: (items, signal) => selection.insertItemsDetailed(items, signal),
    notice,
    changed: vi.fn(),
  });

  const idle = {
    pointerId: null,
    cancel: vi.fn(),
    down: vi.fn(),
    move: vi.fn(),
    up: vi.fn(),
  };

  const options = {
    canvas,
    selection,
    input: idle,
    eraser: idle,
    navigation: {
      pointerId: null,
      endPan: vi.fn(),
      movePan: vi.fn(),
      wheel: vi.fn(),
    },
    getTool: () => "pen",
    canWrite: () => guards.writable,
    interactionsBlocked: () => guards.blocked,
    inputBusy: () => image.busy,
    preservePendingInsertion: () => image.busy,
    drawingPointerId: () => selection.pointerId,
    activeInput: () => selection,
    observeInput: vi.fn(),
    publishHistoryState: vi.fn(),

    cancelPendingInput: () => {
      image.cancel();

      return true;
    },
  } as unknown as BindingOptions;

  const cursor = {
    model: { cancel: vi.fn(), end: vi.fn() },
    sample: vi.fn(),
    update: vi.fn(),
    refresh: vi.fn(),
  } as unknown as Parameters<typeof PointerBinding.create>[2];

  const touch = { cancel: vi.fn(), busy: false } as unknown as Parameters<
    typeof PointerBinding.create
  >[4];

  const interaction = { spaceDown: false, focused: true, keyboardEntry: false };

  const pointer = PointerBinding.create(
    options,
    interaction,
    cursor,
    {} as Parameters<typeof PointerBinding.create>[3],
    touch,
  );

  const keyboard = KeyboardBinding.create(
    options,
    interaction,
    cursor,
    pointer,
  );

  const file = new Blob([ImageAssets.decodeBase64(base64) as BlobPart], {
    type: "image/png",
  });

  return {
    scene,
    selection,
    image,
    images,
    file,
    pointer,
    keyboard,
    options,
    guards,
    started,
    validation,
    validate,
    commit,
    close,
    notice,
    nativeDocument,
    canvas,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("acquired image transaction and native bindings", () => {
  it.each(["none", "pen-hover", "mouse-hover", "pointer-up", "blur", "hidden"])(
    "commits exactly once across %s while validation is pending",
    async (event) => {
      const h = setup();
      const pending = h.image.insertFile(h.file);

      await h.started.promise;
      expect(h.selection.busy).toBe(true);

      const pointerEvent = {
        pointerId: 7,
        pointerType: event === "mouse-hover" ? "mouse" : "pen",
        isPrimary: true,
        button: -1,
        buttons: 0,
        target: h.canvas,
        clientX: 30,
        clientY: 30,
        preventDefault: vi.fn(),
      } as unknown as PointerEvent;

      if (event.endsWith("hover")) h.pointer.move(pointerEvent);

      if (event === "pointer-up") h.pointer.up(pointerEvent);

      if (event === "blur") h.keyboard.blur();

      if (event === "hidden") {
        h.nativeDocument.visibilityState = "hidden";
        h.keyboard.visibility();
      }

      h.validation.resolve();
      await pending;
      expect(h.commit).toHaveBeenCalledOnce();
      expect(h.scene.strokes).toHaveLength(1);
      expect(h.selection.hasImages).toBe(true);
      expect(h.image.status.phase).toBe("success");
      h.image.dispose();
      h.images.dispose();
      expect(h.close).toHaveBeenCalledOnce();
    },
  );
});

describe("image command cancellation and rejection", () => {
  it.each(["Escape", "direct", "selection", "modal", "readonly", "disposal"])(
    "prevents late validation commit after %s and releases its temporary bitmap",
    async (cause) => {
      const h = setup();
      const pending = h.image.insertFile(h.file);

      await h.started.promise;

      const signal = h.validate.mock.calls[0]![1];

      if (cause === "Escape")
        h.keyboard.keyDown({
          code: "Escape",
          target: h.canvas,
          preventDefault: vi.fn(),
        } as unknown as KeyboardEvent);

      if (cause === "direct") h.image.cancel();

      if (cause === "selection") h.pointer.cancel();

      if (cause === "disposal") h.image.dispose();

      if (cause === "modal" || cause === "readonly") {
        if (cause === "modal") h.guards.blocked = true;
        else {
          h.guards.writable = false;
          h.image.cancel();
        }

        h.pointer.move({
          pointerId: 7,
          pointerType: "pen",
          buttons: 0,
        } as PointerEvent);
      }

      expect(signal.aborted).toBe(true);
      await pending;
      expect(h.image.status.phase).toBe("idle");
      expect(h.image.busy).toBe(false);
      expect(h.notice).not.toHaveBeenCalled();
      expect(h.close).toHaveBeenCalledOnce();
      h.validation.resolve();
      await Promise.resolve();
      expect(h.commit).not.toHaveBeenCalled();
      expect(h.scene.strokes).toHaveLength(0);
      expect(h.selection.busy).toBe(false);
      h.image.dispose();
      h.images.dispose();
      expect(h.close).toHaveBeenCalledOnce();
    },
  );

  it("keeps the exact rejection descriptor for both languages and permits a successful retry", async () => {
    const h = setup();
    const reason = Messages.create("imageExceeds8Mib");
    const pending = h.image.insertFile(h.file);

    await h.started.promise;
    h.validation.reject(Messages.error(reason));
    await pending;
    expect(h.image.status).toEqual({ phase: "error", message: reason });
    expect(h.notice).toHaveBeenCalledWith(reason);
    expect(h.selection.message).toEqual(reason);
    expect(h.close).toHaveBeenCalledOnce();
    I18n.initialize("en");

    expect(I18n.text(h.image.status.message)).toBe(
      Messages.resources.en.imageExceeds8Mib,
    );

    await I18n.instance.changeLanguage("ru");

    expect(I18n.text(h.image.status.message)).toBe(
      Messages.resources.ru.imageExceeds8Mib,
    );

    h.validate.mockImplementation(() => Promise.resolve());
    await h.image.insertFile(h.file);
    expect(h.image.status.phase).toBe("success");
    expect(h.commit).toHaveBeenCalledOnce();
    h.image.dispose();
    h.images.dispose();
    expect(h.close).toHaveBeenCalledTimes(2);
  });

  it("cancels an old editor generation without preventing the replacement from inserting", async () => {
    const old = setup();
    const pendingOld = old.image.insertFile(old.file);

    await old.started.promise;
    old.image.dispose();

    const replacement = setup();
    const pendingNew = replacement.image.insertFile(replacement.file);

    await replacement.started.promise;
    old.validation.resolve();
    await pendingOld;
    expect(old.commit).not.toHaveBeenCalled();
    expect(replacement.selection.busy).toBe(true);
    replacement.validation.resolve();
    await pendingNew;
    expect(replacement.commit).toHaveBeenCalledOnce();
    old.images.dispose();
    replacement.image.dispose();
    replacement.images.dispose();
  });

  it("blocks new pointer edits and wheel navigation while the image transaction owns input", async () => {
    const h = setup();
    const pending = h.image.insertFile(h.file);

    await h.started.promise;

    h.pointer.down({
      pointerId: 7,
      pointerType: "pen",
      buttons: 1,
    } as PointerEvent);

    h.pointer.wheel({
      cancelable: true,
      preventDefault: vi.fn(),
    } as unknown as WheelEvent);

    expect(h.options.input.down).not.toHaveBeenCalled();
    expect(h.options.navigation.wheel).not.toHaveBeenCalled();
    h.validation.resolve();
    await pending;
    expect(h.commit).toHaveBeenCalledOnce();
    h.image.dispose();
    h.images.dispose();
  });

  it("retains a canonical bitmap while cancelling a pending duplicate transaction", async () => {
    const h = setup();
    const first = h.image.insertFile(h.file);

    await h.started.promise;
    h.validation.resolve();
    await first;

    const original = h.scene.strokes[0]!;

    expect(original.kind).toBe("image");

    if (original.kind !== "image") throw new Error("expected image");

    const gate = deferred<void>();
    const started = deferred<void>();

    h.validate.mockImplementation(() => {
      started.resolve();

      return gate.promise;
    });

    const duplicate = h.image.insertFile(h.file);

    await started.promise;
    h.image.cancel();
    await duplicate;
    gate.resolve();
    await Promise.resolve();
    expect(h.scene.strokes).toEqual([original]);
    expect(h.images.get(original.asset)).not.toBeNull();
    expect(h.close).not.toHaveBeenCalled();
    h.image.dispose();
    h.images.dispose();
    expect(h.close).toHaveBeenCalledOnce();
  });

  it("a cancelled validation result cannot affect a newer image transaction", async () => {
    const h = setup();
    const first = h.image.insertFile(h.file);

    await h.started.promise;
    h.image.cancel();
    await first;

    const gate = deferred<void>();
    const started = deferred<void>();

    h.validate.mockImplementation(() => {
      started.resolve();

      return gate.promise;
    });

    const current = h.image.insertFile(h.file);

    await started.promise;
    h.validation.reject(new Error("late first validation failure"));
    await Promise.resolve();
    expect(h.image.busy).toBe(true);
    expect(h.selection.busy).toBe(true);
    expect(h.notice).not.toHaveBeenCalled();
    gate.resolve();
    await current;
    expect(h.commit).toHaveBeenCalledOnce();
    expect(h.image.status.phase).toBe("success");
    h.image.dispose();
    h.images.dispose();
    expect(h.close).toHaveBeenCalledTimes(2);
  });

  it("passive hover preserves a pending non-editing selection on a read-only board", async () => {
    const h = setup();

    h.scene.strokes = [
      {
        id: 1,
        width: 2,
        color: "#182230",
        points: [{ x: 20, y: 20, pressure: 0.5, time: 0 }],
      },
    ];

    const gate = deferred<{
      region: import("~/entities/board").ClipMask;
      parts: [];
    }>();

    const selection = new BoardSelection({
      scene: h.scene,
      bounds: h.canvas.getBoundingClientRect,
      viewport: () => ({ x: 0, y: 0, zoom: 1 }),
      writable: () => false,
      select: () => gate.promise,
      validate: vi.fn(),
      commit: vi.fn(),
      preview: vi.fn(),
      changed: vi.fn(),
      setViewport: vi.fn(),
    });

    h.options.selection = selection;
    h.options.canWrite = () => false;

    const pointer = PointerBinding.create(
      h.options,
      { spaceDown: false, focused: true, keyboardEntry: false },
      { sample: vi.fn(), update: vi.fn() } as unknown as Parameters<
        typeof PointerBinding.create
      >[2],
      {} as Parameters<typeof PointerBinding.create>[3],
      { busy: false } as unknown as Parameters<typeof PointerBinding.create>[4],
    );

    selection.all();

    pointer.move({
      pointerId: 7,
      pointerType: "pen",
      buttons: 0,
    } as PointerEvent);

    expect(selection.busy).toBe(true);
    gate.resolve({ region: [], parts: [] });
    await Promise.resolve();
    expect(selection.busy).toBe(false);
    h.image.dispose();
    h.images.dispose();
  });

  it.each(["bytes", "decode"])(
    "keeps acquired image %s alive across native blur and hidden visibility",
    async (stage) => {
      const h = setup();
      const started = deferred<void>();
      const bytes = deferred<ArrayBuffer>();
      const bitmap = deferred<ImageBitmap>();
      const originalBytes = await h.file.arrayBuffer();

      if (stage === "bytes")
        vi.spyOn(h.file, "arrayBuffer").mockImplementation(() => {
          started.resolve();

          return bytes.promise;
        });
      else
        vi.stubGlobal("createImageBitmap", () => {
          started.resolve();

          return bitmap.promise;
        });

      const pending = h.image.insertFile(h.file);

      await started.promise;
      h.keyboard.blur();
      h.nativeDocument.visibilityState = "hidden";
      h.keyboard.visibility();
      expect(h.image.busy).toBe(true);
      bytes.resolve(originalBytes);

      bitmap.resolve({
        width: 1,
        height: 1,
        close: h.close,
      } as unknown as ImageBitmap);

      await h.started.promise;
      h.validation.resolve();
      await pending;
      expect(h.commit).toHaveBeenCalledOnce();
      expect(h.image.status.phase).toBe("success");
      h.image.dispose();
      h.images.dispose();
      expect(h.close).toHaveBeenCalledOnce();
    },
  );

  it("aborts acquired bytes without allocating an image and permits a newer insertion", async () => {
    const h = setup();
    const bytes = deferred<ArrayBuffer>();
    const originalBytes = await h.file.arrayBuffer();

    vi.spyOn(h.file, "arrayBuffer").mockReturnValueOnce(bytes.promise);

    const old = h.image.insertFile(h.file);

    h.image.cancel();

    const current = h.image.insertFile(h.file);

    await h.started.promise;
    bytes.resolve(originalBytes);
    await old;
    expect(h.image.busy).toBe(true);
    h.validation.resolve();
    await current;
    expect(h.commit).toHaveBeenCalledOnce();
    expect(h.image.status.phase).toBe("success");
    h.image.dispose();
    h.images.dispose();
    expect(h.close).toHaveBeenCalledOnce();
  });

  it("ordinary blur still cancels a partial selection gesture and uncommitted keyboard nudge", async () => {
    const h = setup();

    h.selection.down({
      pointerId: 7,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
      timeStamp: 1,
    });

    expect(h.selection.pointerId).toBe(7);
    h.keyboard.blur();
    expect(h.selection.pointerId).toBeNull();

    const pending = h.image.insertFile(h.file);

    await h.started.promise;
    h.validation.resolve();
    await pending;

    const before = h.selection.selected[0];

    h.selection.nudge(50, 20);
    expect(h.selection.busy).toBe(true);
    h.keyboard.blur();
    expect(h.selection.busy).toBe(false);
    expect(h.selection.selected[0]).toEqual(before);
    expect(h.commit).toHaveBeenCalledOnce();
    h.image.dispose();
    h.images.dispose();
  });
});
