import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasRenderer } from "./renderer";
import { SurfaceResolution } from "./surface-resolution";

afterEach(() => vi.unstubAllGlobals());
function harness(physical = true, unsupportedBox = false) {
  const viewport = Object.assign(new EventTarget(), { scale: 1 });
  const windowEvents = Object.assign(new EventTarget(), {
    devicePixelRatio: 1,
    visualViewport: viewport,
  });
  vi.stubGlobal("window", windowEvents);
  let observerCallback: ResizeObserverCallback = () => {};
  const observe = vi.fn(
    (_element: Element, options?: ResizeObserverOptions) => {
      if (unsupportedBox && options) throw new Error("box unsupported");
    },
  );
  const disconnect = vi.fn();
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: ResizeObserverCallback) {
        observerCallback = callback;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
  class Entry {}
  if (physical)
    Object.defineProperty(Entry.prototype, "devicePixelContentBoxSize", {
      value: [],
    });
  vi.stubGlobal("ResizeObserverEntry", Entry);
  const size = { width: 640, height: 480 };
  const canvas = {
    getBoundingClientRect: () => ({ ...size }),
  } as HTMLCanvasElement;
  const renderer = new CanvasRenderer(
    { canvas, context: {} as CanvasRenderingContext2D },
    { canvas, context: {} as CanvasRenderingContext2D },
    { strokes: [], active: null },
    { zoom: 1, x: 0, y: 0 },
    { request: vi.fn(() => 1), cancel: vi.fn() },
  );
  const resize = vi.spyOn(renderer, "resize"),
    cancel = vi.fn(),
    resolved = vi.fn();
  const dispose = SurfaceResolution.bind(canvas, renderer, cancel, resolved);
  return {
    windowEvents,
    viewport,
    size,
    canvas,
    resize,
    cancel,
    resolved,
    observe,
    disconnect,
    dispose,
    observation: () => observerCallback([], {} as ResizeObserver),
  };
}
describe("surface resolution ownership", () => {
  it("observes physical size, responds to layout and DPR changes, and disconnects on disposal", () => {
    const h = harness();
    expect(h.observe).toHaveBeenCalledExactlyOnceWith(h.canvas, {
      box: "device-pixel-content-box",
    });
    expect(h.resize).toHaveBeenLastCalledWith(640, 480, 1, 1);
    h.size.width = 800;
    h.observation();
    expect(h.resize).toHaveBeenLastCalledWith(800, 480, 1, 1);
    h.windowEvents.devicePixelRatio = 2;
    h.observation();
    expect(h.resize).toHaveBeenLastCalledWith(800, 480, 2, 1);
    h.viewport.scale = 1.5;
    h.viewport.dispatchEvent(new Event("resize"));
    expect(h.resize).toHaveBeenLastCalledWith(800, 480, 2, 1.5);
    expect(h.resolved).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dpr: 2,
        nativeScale: 1.5,
        bitmapWidth: 2400,
        bitmapHeight: 1440,
      }),
    );
    const count = h.resize.mock.calls.length;
    h.observation();
    expect(h.resize).toHaveBeenCalledTimes(count);
    expect(h.cancel).toHaveBeenCalledTimes(count);
    h.dispose();
    expect(h.disconnect).toHaveBeenCalledOnce();
    h.size.width = 300;
    h.windowEvents.dispatchEvent(new Event("resize"));
    h.viewport.dispatchEvent(new Event("resize"));
    expect(h.resize).toHaveBeenCalledTimes(count);
  });
  it("uses content-box observation when physical-size entries are unavailable", () => {
    const h = harness(false);
    expect(h.observe).toHaveBeenCalledExactlyOnceWith(h.canvas, {
      box: "content-box",
    });
    h.dispose();
    expect(h.disconnect).toHaveBeenCalledOnce();
  });
  it("falls back to plain observation when the browser rejects box options", () => {
    const h = harness(true, true);
    expect(h.observe.mock.calls).toEqual([
      [h.canvas, { box: "device-pixel-content-box" }],
      [h.canvas],
    ]);
    h.dispose();
    expect(h.disconnect).toHaveBeenCalledOnce();
  });
});
