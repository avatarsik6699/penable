// Native editor generation lifecycle, including images, selection jobs and DOM bindings.
import { EditorRuntime } from "@workspace";

function probe() {
  const state = {
    workers: 0,
    terminated: 0,
    bitmaps: 0,
    closed: 0,
    observers: 0,
    decoding: 0,
  };

  const listeners = new Set(),
    frames = new Set(),
    ids = new WeakMap();

  let next = 0;

  const id = (value) => {
    if (!ids.has(value)) ids.set(value, ++next);

    return ids.get(value);
  };

  const key = (target, type, listener, options) =>
    `${id(target)}:${type}:${id(listener)}:${typeof options === "boolean" ? options : !!options?.capture}`;

  const native = {
    add: EventTarget.prototype.addEventListener,
    remove: EventTarget.prototype.removeEventListener,
    request: window.requestAnimationFrame,
    cancel: window.cancelAnimationFrame,
    Worker: window.Worker,
    Observer: window.ResizeObserver,
    bitmap: window.createImageBitmap,
  };

  EventTarget.prototype.addEventListener = function (type, listener, options) {
    if (listener) listeners.add(key(this, type, listener, options));

    return native.add.call(this, type, listener, options);
  };

  EventTarget.prototype.removeEventListener = function (
    type,
    listener,
    options,
  ) {
    if (listener) listeners.delete(key(this, type, listener, options));

    return native.remove.call(this, type, listener, options);
  };

  window.requestAnimationFrame = (callback) => {
    const handle = native.request.call(window, (time) => {
      frames.delete(handle);
      callback(time);
    });

    frames.add(handle);

    return handle;
  };

  window.cancelAnimationFrame = (handle) => {
    frames.delete(handle);
    native.cancel.call(window, handle);
  };

  window.Worker = class extends native.Worker {
    constructor(...args) {
      super(...args);
      state.workers++;
    }

    terminate() {
      state.terminated++;
      super.terminate();
    }
  };

  window.ResizeObserver = class extends native.Observer {
    active = false;

    observe(...args) {
      if (!this.active) {
        state.observers++;
        this.active = true;
      }

      super.observe(...args);
    }

    disconnect() {
      if (this.active) {
        state.observers--;
        this.active = false;
      }

      super.disconnect();
    }
  };

  window.createImageBitmap = async (...args) => {
    state.decoding++;

    let bitmap;

    try {
      bitmap = await native.bitmap.call(window, ...args);
    } finally {
      state.decoding--;
    }

    const close = bitmap.close.bind(bitmap);

    let closed = false;

    state.bitmaps++;

    bitmap.close = () => {
      if (!closed) {
        state.closed++;
        closed = true;
      }

      close();
    };

    return bitmap;
  };

  return {
    read: () => ({ ...state, listeners: listeners.size, frames: frames.size }),

    stop: () => {
      EventTarget.prototype.addEventListener = native.add;
      EventTarget.prototype.removeEventListener = native.remove;
      window.requestAnimationFrame = native.request;
      window.cancelAnimationFrame = native.cancel;
      window.Worker = native.Worker;
      window.ResizeObserver = native.Observer;
      window.createImageBitmap = native.bitmap;
    },
  };
}

async function run(fixture, cycles = 12) {
  const image = document.createElement("canvas");

  image.width = image.height = 16;
  image.getContext("2d").fillRect(0, 0, 16, 16);

  const asset = {
    id: "lifecycle40",
    mime: "image/png",
    width: 16,
    height: 16,
    base64: image.toDataURL().split(",")[1],
  };

  const resources = probe(),
    snapshots = [],
    work = [];

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  try {
    for (let cycle = 0; cycle < cycles; cycle++) {
      const source = fixture(600, 50, true);

      source.strokes.push({
        kind: "image",
        id: 601,
        asset,
        matrix: [1, 0, 0, 1, 100, 100],
      });

      const controlsRef = { current: null };
      const start = performance.now();

      const editor = EditorRuntime.create(
        {
          canvas: document.getElementById("live"),
          completed: document.getElementById("completed"),
          background: null,
          selectionPath: null,
          selectionHandles: null,
          cursor: null,
          focusBadge: null,
          mapHost: null,
          mapCanvas: null,
          mapArea: null,
          mapFrame: null,
          mapMarker: null,
          mapStatus: null,
          mapOutside: null,
          mapFit: null,
        },
        () => ({
          initialDocument: source,
          clipboard: { strokes: [] },
          canWrite: () => true,
          interactionsBlocked: () => false,

          onActivateSelection: () => {},

          onSelectionState: () => {},

          getTool: () => "pen",

          onDocumentChange: () => {},

          onHistoryState: () => {},

          controlsRef,

          onDiagnostics: () => {},

          onUnavailable: (message) => {
            throw new Error(JSON.stringify(message));
          },

          onNavigationNotice: () => {},

          onScenePresence: () => {},

          onWritingCommitted: () => {},

          width: 3,
          stabilization: 65,
          writing: source.tools.writing,
          background: "blank",
          backgroundSettings: source.backgroundSettings,
          lastWritingView: null,
          minimapOpen: false,

          onMinimapClose: () => {},

          bindMinimapRoot: () => {},

          modalOpen: false,
          uiRevision: 0,
        }),
      );

      work.push(performance.now() - start);

      try {
        controlsRef.current.zoomIn();
        controlsRef.current.zoomOut();
        controlsRef.current.selection("all");

        if (cycle % 2) await tick(); // include both pending and completed image decodes/jobs
      } finally {
        editor.dispose();
      }

      const deadline = performance.now() + 5000;
      let state;

      do {
        await tick();
        state = resources.read();
      } while (
        (state.decoding ||
          state.workers !== state.terminated ||
          state.bitmaps !== state.closed) &&
        performance.now() < deadline
      );

      if (
        controlsRef.current !== null ||
        state.decoding ||
        state.workers !== state.terminated ||
        state.bitmaps !== state.closed ||
        state.listeners ||
        state.frames ||
        state.observers
      )
        throw new Error(
          `Owned editor resources retained: ${JSON.stringify(state)}`,
        );

      snapshots.push(state);
    }

    return {
      fixture: "native-editor-lifecycle",
      cycles,
      work,
      snapshots,
      scope:
        "real EditorRuntime, selection workers, native image decode/close, listeners/RAF/ResizeObserver; not GPU driver allocation",
    };
  } finally {
    resources.stop();
  }
}

export const EditorLifecycleBenchmark = { run };
