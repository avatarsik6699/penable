import { describe, expect, it, vi } from "vitest";
import { BoardConstants, BoardSnapshots, type Stroke } from "~/entities/board";
import {
  BoardLibrarySession,
  DocumentCodec,
  DocumentSession,
  LibraryCatalog,
  type DocumentRepository,
  type DocumentPersistence,
  type LibraryRepository,
  type StoredRecord,
} from "~/features/board-document";
import { WorkspaceModel, type WorkspaceDependencies } from "./workspace-model";
import type { SurfaceControls } from "./workspace-model.types";

const diagnostics: WorkspaceDependencies["diagnostics"] = {
  pointerType: null,
  inputEvent: null,
  lastPenContact: null,
  pressure: null,
  active: false,
  dpr: 1,
  coalesced: false,
  zoom: 1,
  nativeScale: 1,
  requestedRatio: 1,
  effectiveRatio: 1,
  bitmapWidth: 0,
  bitmapHeight: 0,
  resolutionCapped: false,
};

function deferred() {
  let resolve!: () => void;

  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });

  return { resolve, promise };
}

async function microtasks() {
  for (let index = 0; index < 20; index++) await Promise.resolve();
}

function harness(
  persistence?: DocumentPersistence,
  exportDocument: WorkspaceDependencies["exportDocument"] = async (
    document,
  ) => {
    const result = DocumentCodec.serializeDocument(document);

    return { contents: result.json, warning: result.warning };
  },
) {
  const sessions: DocumentSession[] = [],
    releases: ReturnType<typeof vi.fn>[] = [];

  const repository: DocumentRepository = {
    read: async () => ({
      main: { exists: false, value: undefined },
      beforeImport: { exists: false, value: undefined },
    }),
    write: vi.fn(async () => {}),
    replace: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };

  const acquire = vi.fn(async () => {
    const release = vi.fn(async () => {});

    releases.push(release);

    return { acquired: true, message: "", release };
  });

  let invalidate: (message: string) => void = () => {};

  const download = vi.fn();

  const model = new WorkspaceModel({
    diagnostics,
    download,
    exportDocument,

    session: (options) => {
      const session = new DocumentSession({
        ...options,
        persistence,
        acquire,

        open: async (callback) => {
          invalidate = callback;

          return repository;
        },
      });

      sessions.push(session);

      return session;
    },
  });

  return {
    model,
    download,
    sessions,
    releases,
    repository,
    acquire,
    invalidate: () => invalidate("connection lost"),
  };
}

function controls(strokes: Stroke[] = []): SurfaceControls {
  return {
    snapshot: () => ({ strokes, viewport: { zoom: 1, x: 0, y: 0 } }),
    isBusy: () => false,
    cancelInput: vi.fn(),
    selection: vi.fn(),
    selectionShape: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    reset: vi.fn(),
    fitAll: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
  };
}

describe("asynchronous recovery export ownership", () => {
  it("clears the prior reader board when reconnect loads a different corrupt active record", async () => {
    const oldBoard = DocumentCodec.emptyDocument();

    oldBoard.background = "dots";

    const failed = {
      format: "penable-board",
      schemaVersion: 99,
      marker: "original",
    };

    const records = new Map<string, unknown>([
      ["main", DocumentCodec.encodeDocument(oldBoard)],
      ["broken", failed],
    ]);

    let catalog = LibraryCatalog.initial();

    catalog.boards.push({
      id: "broken",
      title: "Broken",
      appearance: { color: "blue", icon: "book" },
    });

    const record = (id: string): StoredRecord => ({
      exists: records.has(id),
      value: records.get(id),
    });

    const library: LibraryRepository = {
      read: async () => ({
        catalog: { exists: true, value: catalog },
        main: record("main"),
      }),
      board: async (id) => record(id),
      close: vi.fn(async () => {}),
      bootstrap: vi.fn(async () => {}),
      migrate: vi.fn(async () => {}),
      update: vi.fn(async () => {}),
    };

    const write = vi.fn(async () => {}),
      replace = vi.fn(async () => {}),
      download = vi.fn();

    const model = new WorkspaceModel({
      diagnostics,
      download,
      exportDocument: async (document) => ({
        contents: JSON.stringify(DocumentCodec.encodeDocument(document)),
        warning: "",
      }),
      session: (options) =>
        new BoardLibrarySession({
          ...options,
          id: () => "new-board",
          acquire: async () => ({
            acquired: false,
            message: "readonly",

            release: async () => {},
          }),
          open: async () => library,
          session: (id, lease, callbacks) =>
            new DocumentSession({
              ...callbacks,
              acquire: async () => lease,
              open: async () => ({
                read: async () => ({
                  main: record(id),
                  beforeImport: record("before-import"),
                }),
                write,
                replace,

                close: async () => {},
              }),
            }),
        }),
    });

    const stop = model.start();

    await vi.waitFor(() =>
      expect(model.getSnapshot().storage.canReconnect).toBe(true),
    );

    expect(model.getSnapshot().hasBoard).toBe(true);
    model.controls.current = controls();
    catalog = { ...catalog, activeId: "broken" };
    model.retry();
    expect(model.getSnapshot().storage.phase).toBe("loading");
    expect(model.getSnapshot().hasBoard).toBe(false);

    await vi.waitFor(() =>
      expect(model.getSnapshot().library.activeId).toBe("broken"),
    );

    expect(model.getSnapshot().storage.phase).toBe("error");
    expect(model.getSnapshot().library.recovery?.previewId).toBeNull();
    await model.exportCurrent();
    expect(download).not.toHaveBeenCalled();

    model.previewBoard("main");

    await vi.waitFor(() =>
      expect(model.getSnapshot().library.recovery?.previewId).toBe("main"),
    );

    model.controls.current = controls();
    expect(model.canWrite()).toBe(false);
    model.documentChanged(true);
    await model.flush();
    await model.exportCurrent();

    expect(download).toHaveBeenLastCalledWith(
      expect.stringContaining('"background":"dots"'),
      "penable-board.json",
    );

    await model.exportRaw();

    const [contents, file] = download.mock.lastCall! as [string, string];

    expect(JSON.parse(contents)).toEqual(failed);
    expect(file).toBe("penable-original-record.json");
    expect(write).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(library.update).not.toHaveBeenCalled();
    expect(library.bootstrap).not.toHaveBeenCalled();
    expect(library.migrate).not.toHaveBeenCalled();
    model.closePreview();
    expect(model.getSnapshot().hasBoard).toBe(false);
    expect(model.getSnapshot().library.activeId).toBe("broken");
    stop();
  });

  it("keeps downloads available after writer authority is lost", async () => {
    const h = harness(),
      stop = h.model.start();

    await microtasks();
    h.invalidate();
    expect(h.model.canWrite()).toBe(false);

    expect(await h.model.exportCurrent()).toEqual({
      code: "copySentToTheBrowserForDownload",
    });

    expect(h.download).toHaveBeenCalledOnce();
    expect(h.download.mock.calls[0]![1]).toBe("penable-board.json");
    stop();
  });

  it("aborts owned export on disposal and never downloads a late result", async () => {
    let signal: AbortSignal | undefined;
    let complete!: (value: { contents: string; warning: string }) => void;

    const pending = new Promise<{ contents: string; warning: string }>(
      (resolve) => {
        complete = resolve;
      },
    );

    const h = harness(undefined, (_document, current) => {
        signal = current;

        return pending;
      }),
      stop = h.model.start();

    await microtasks();

    const exporting = h.model.exportCurrent();

    stop();
    expect(signal?.aborted).toBe(true);
    complete({ contents: "late", warning: "" });
    await exporting;
    expect(h.download).not.toHaveBeenCalled();
  });
});

describe("tab and editor ownership", () => {
  it("caches an immutable coarse projection without observing or cloning raw points", async () => {
    const h = harness(),
      stop = h.model.start();

    await microtasks();

    let reads = 0;
    const raw: Stroke["points"] = [{ x: 1, y: 2, pressure: 1, time: 1 }];

    const points = new Proxy(raw, {
      get(target, property, receiver) {
        if (typeof property === "string" && /^\d+$/.test(property)) reads++;

        return Reflect.get(target, property, receiver);
      },
    });

    const stroke: Stroke = {
      id: 1,
      color: BoardConstants.INK,
      width: 3,
      points,
    };

    h.model.controls.current = controls([stroke]);

    const notify = vi.fn(),
      unsubscribe = h.model.subscribe(notify),
      ui = h.model.getSnapshot();

    for (let index = 0; index < 100; index++) {
      raw.push(raw[0]!);
      expect(h.model.getSnapshot()).toBe(ui);
    }

    expect(notify).not.toHaveBeenCalled();
    expect(reads).toBe(0);

    const captured = h.model.readBoardSnapshot();

    expect(captured.strokes[0]).toBe(stroke);

    expect(
      (captured.strokes[0]! as import("~/entities/board").Stroke).points,
    ).toBe(points);

    expect(reads).toBe(0);
    expect(captured).not.toHaveProperty("schemaVersion");
    expect(captured).not.toHaveProperty("format");
    expect(ui).not.toHaveProperty("strokes");
    expect(ui).not.toHaveProperty("scene");
    expect(ui).not.toHaveProperty("document");
    expect(Object.isFrozen(ui)).toBe(true);
    expect(Object.isFrozen(ui.storage)).toBe(true);
    expect(Object.isFrozen(ui.history)).toBe(true);
    h.model.changeWidth(4);
    expect(h.model.getSnapshot()).not.toBe(ui);
    expect(h.model.canWrite()).toBe(true);
    unsubscribe();
    stop();
    await h.sessions[0]!.dispose();
  });

  it("import replaces only the editor generation and keeps the clipboard and durable writer", async () => {
    const persistence = {
        write: vi.fn(async () => {}),
        close: vi.fn(async () => {}),
      },
      h = harness(persistence);

    const stop = h.model.start();

    await microtasks();

    const editor = controls();

    h.model.controls.current = editor;

    const clipboard = h.model.clipboard,
      source: Stroke = {
        id: 1,
        color: BoardConstants.INK,
        width: 3,
        points: [{ x: 1, y: 2, pressure: 1, time: 1 }],
      };

    clipboard.strokes.push(source);

    const generation = h.model.getSnapshot().generation;

    expect(h.model.beginImport()).toBe("");

    const dto = DocumentCodec.emptyDocument();

    dto.background = "dots";
    await h.model.confirmImport(dto);
    expect(h.model.getSnapshot().generation).toBe(generation + 1);
    expect(h.model.readInitialBoard().background).toBe("dots");
    expect(h.model.clipboard).toBe(clipboard);
    expect(clipboard.strokes[0]).toBe(source);
    expect(h.model.controls.current).toBeNull();
    expect(editor.cancelInput).toHaveBeenCalled();
    expect(h.sessions).toHaveLength(1);
    expect(persistence.close).not.toHaveBeenCalled();
    expect(h.releases[0]).not.toHaveBeenCalled();
    h.model.endImport();
    h.model.controls.current = controls();
    expect(h.model.canWrite()).toBe(true);
    stop();
    await h.sessions[0]!.dispose();
    expect(persistence.close).toHaveBeenCalledOnce();
    expect(h.releases[0]).toHaveBeenCalledOnce();
  });

  it("waits for the prior durable drain before StrictMode reacquires the lease", async () => {
    const draining = deferred(),
      persistence = {
        write: vi.fn(async () => {}),
        close: vi.fn(() => draining.promise),
      },
      h = harness(persistence);

    const stop = h.model.start();

    await microtasks();
    expect(h.acquire).toHaveBeenCalledTimes(1);
    stop();

    const stopAgain = h.model.start();

    await microtasks();
    expect(persistence.close).toHaveBeenCalledTimes(1);
    expect(h.acquire).toHaveBeenCalledTimes(1);
    expect(h.releases[0]).not.toHaveBeenCalled();
    draining.resolve();
    await microtasks();
    expect(h.releases[0]).toHaveBeenCalledOnce();
    expect(h.acquire).toHaveBeenCalledTimes(2);
    stopAgain();
    await h.sessions[1]!.dispose();
    expect(h.releases[1]).toHaveBeenCalledOnce();
  });

  it("unmount after reconnect closes the current session rather than a stale effect session", async () => {
    const h = harness(),
      stop = h.model.start();

    await microtasks();
    h.invalidate();
    expect(h.model.getSnapshot().storage.canReconnect).toBe(true);
    h.model.retry();
    await microtasks();
    expect(h.sessions).toHaveLength(2);
    stop();
    await h.sessions[1]!.dispose();
    expect(h.releases[0]).toHaveBeenCalledOnce();
    expect(h.releases[1]).toHaveBeenCalledOnce();
  });

  it("a second tab receives its own ephemeral clipboard", () => {
    const first = harness(),
      second = harness();

    first.model.clipboard.strokes = BoardSnapshots.empty().strokes;
    expect(first.model.clipboard).not.toBe(second.model.clipboard);
  });
});

describe("workspace view metadata", () => {
  it("coalesces background settings and captures detached metadata in the durable snapshot", async () => {
    vi.useFakeTimers();

    const h = harness(),
      stop = h.model.start();

    try {
      await microtasks();
      h.model.controls.current = controls();
      h.model.changeBackground("dots");

      for (let contrast = 1; contrast <= 73; contrast++)
        h.model.changeBackgroundSettings({ contrast, spacing: 32 });

      const anchor = { center: { x: 500, y: -100 }, zoom: 2 };

      h.model.writingCommitted(anchor);
      anchor.center.x = 999;

      const snapshot = h.model.readBoardSnapshot();

      expect(snapshot.backgroundSettings).toEqual({
        contrast: 73,
        spacing: 32,
      });

      expect(snapshot.lastWritingView).toEqual({
        center: { x: 500, y: -100 },
        zoom: 2,
      });

      snapshot.backgroundSettings!.contrast = 0;
      snapshot.lastWritingView!.center.x = 0;
      expect(h.model.getSnapshot().backgroundSettings.contrast).toBe(73);
      expect(h.model.getSnapshot().lastWritingView!.center.x).toBe(500);
      expect(h.repository.write).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(300);
      expect(h.repository.write).toHaveBeenCalledOnce();

      expect(vi.mocked(h.repository.write).mock.calls[0]![0]).toMatchObject({
        schemaVersion: 5,
        backgroundSettings: { contrast: 73, spacing: 32 },
        lastWritingView: { center: { x: 500, y: -100 }, zoom: 2 },
      });

      h.model.changeBackground("blank");

      expect(h.model.getSnapshot().backgroundSettings).toEqual({
        contrast: 73,
        spacing: 32,
      });

      h.invalidate();

      const ui = h.model.getSnapshot();

      h.model.changeBackgroundSettings({ contrast: 80, spacing: 24 });
      h.model.writingCommitted({ center: { x: 0, y: 0 }, zoom: 1 });
      expect(h.model.getSnapshot()).toBe(ui);
    } finally {
      stop();
      await h.sessions[0]!.dispose();
      vi.useRealTimers();
    }
  });
});

describe("independent instrument preferences", () => {
  it("restores per-instrument width/color and keeps legacy pen fields valid in durable snapshots", async () => {
    const h = harness(),
      stop = h.model.start();

    await microtasks();
    h.model.controls.current = controls();
    h.model.changeWidth(4.2);
    h.model.changeInkSettings({ color: "#175cd3" });
    h.model.changeInstrument("highlighter");
    h.model.changeWidth(48);
    h.model.changeInkSettings({ opacity: 0.6, color: "#d92d20" });
    expect(h.model.getSnapshot().width).toBe(48);

    const captured = h.model.readBoardSnapshot();

    expect(captured.tools.width).toBe(4.2);

    expect(captured.tools.writing!.instruments.highlighter).toMatchObject({
      width: 48,
      color: "#d92d20",
      opacity: 0.6,
    });

    h.model.changeInstrument("pen");
    expect(h.model.getSnapshot().width).toBe(4.2);
    expect(h.model.getSnapshot().writing.instruments.pen.color).toBe("#175cd3");
    h.model.changeInstrument("highlighter");
    expect(h.model.getSnapshot().width).toBe(48);
    stop();
    await h.sessions[0]!.dispose();
  });
});

describe("instrument interaction cancellation", () => {
  it("cancels an armed placement and clears selection before activating another writing instrument", async () => {
    const h = harness(),
      stop = h.model.start();

    await microtasks();

    let armed = true;
    const surface = controls();

    surface.cancelInput = vi.fn(() => {
      armed = false;
    });

    h.model.controls.current = surface;
    h.model.changeInstrument("highlighter");
    expect(surface.cancelInput).toHaveBeenCalledOnce();
    expect(armed).toBe(false);
    expect(surface.selection).toHaveBeenCalledWith("clear");
    expect(h.model.getSnapshot().writing.instrument).toBe("highlighter");
    expect(h.model.getSnapshot().tool).toBe("pen");
    stop();
    await h.sessions[0]!.dispose();
  });
});

it("keeps finger editing an explicit transient tab preference and guards busy or readonly changes", async () => {
  const h = harness();

  expect(h.model.getFingerInput()).toBe(false);
  h.model.changeFingerInput(true);
  expect(h.model.getFingerInput()).toBe(false);

  const stop = h.model.start();

  await microtasks();
  h.model.controls.current = controls();
  h.model.changeFingerInput(true);
  expect(h.model.getFingerInput()).toBe(true);
  expect(h.model.readBoardSnapshot()).not.toHaveProperty("fingerInput");
  h.model.controls.current.isBusy = () => true;
  h.model.changeFingerInput(false);
  expect(h.model.getFingerInput()).toBe(true);
  stop();
  await h.sessions[0]!.dispose();
});
