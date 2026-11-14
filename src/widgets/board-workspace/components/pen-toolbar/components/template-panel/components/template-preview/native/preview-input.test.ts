import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardTemplates } from "~/entities/board";
import { PreviewCamera } from "../preview-camera";
import { PreviewInput } from "./preview-input";

class Target {
  listeners = new Map<string, Set<(event: never) => void>>();
  captured: number | null = null;
  focus = vi.fn();

  addEventListener(name: string, fn: (event: never) => void) {
    const list = this.listeners.get(name) ?? new Set();

    list.add(fn);
    this.listeners.set(name, list);
  }

  removeEventListener(name: string, fn: (event: never) => void) {
    this.listeners.get(name)?.delete(fn);
  }

  emit(name: string, event: unknown) {
    for (const fn of this.listeners.get(name) ?? []) fn(event as never);
  }

  getBoundingClientRect() {
    return { width: 280, height: 240 };
  }

  setPointerCapture(id: number) {
    this.captured = id;
  }

  hasPointerCapture(id: number) {
    return this.captured === id;
  }

  releasePointerCapture() {
    this.captured = null;
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("owned preview interaction lifecycle", () => {
  it.each(["touch", "mouse"])(
    "pans %s locally, handles keyboard, releases capture and all listeners on cleanup",
    (pointerType) => {
      const region = new Target(),
        svg = new Target(),
        win = new Target(),
        disconnect = vi.fn();

      vi.stubGlobal("window", win);

      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe = vi.fn();
          disconnect = disconnect;
        },
      );

      const camera = new PreviewCamera(BoardTemplates.defaults("axes")),
        changed = vi.fn();

      const dispose = PreviewInput.bind(
        region as unknown as HTMLElement,
        svg as unknown as SVGSVGElement,
        camera,
        changed,
      );

      const initial = camera.snapshot.viewBox;

      const event = {
        pointerId: 1,
        pointerType,
        button: 0,
        clientX: 100,
        clientY: 100,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      };

      svg.emit("pointerdown", event);
      svg.emit("pointermove", { ...event, clientX: 130 });
      expect(camera.snapshot.viewBox).not.toBe(initial);
      expect(svg.captured).toBe(1);
      svg.emit("pointercancel", event);
      expect(svg.captured).toBeNull();

      const cancelled = camera.snapshot.viewBox;

      svg.emit("pointermove", { ...event, clientX: 200 });
      expect(camera.snapshot.viewBox).toBe(cancelled);
      region.emit("keydown", { ...event, code: "ArrowRight" });
      expect(camera.snapshot.viewBox).not.toBe(cancelled);
      svg.emit("pointerdown", event);
      win.emit("blur", {});
      expect(svg.captured).toBeNull();
      dispose();
      expect(disconnect).toHaveBeenCalledOnce();

      for (const target of [region, svg, win])
        expect(
          [...target.listeners.values()].every((list) => list.size === 0),
        ).toBe(true);
    },
  );
});

it("deduplicates equal preview dimensions and commits observer changes outside its notification with frame cleanup", () => {
  const region = new Target(),
    svg = new Target(),
    win = new Target(),
    changed = vi.fn();

  let notify = () => {},
    width = 280;

  let frame: (() => void) | null = null;

  const request = vi.fn((callback: () => void) => {
    frame = callback;

    return 7;
  });

  const cancel = vi.fn();

  vi.stubGlobal("window", win);
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        notify = callback;
      }

      observe = vi.fn();
      disconnect = vi.fn();
    },
  );

  svg.getBoundingClientRect = () => ({ width, height: 240 });

  const camera = new PreviewCamera(BoardTemplates.defaults("axes"));

  const dispose = PreviewInput.bind(
    region as unknown as HTMLElement,
    svg as unknown as SVGSVGElement,
    camera,
    changed,
  );

  expect(changed).toHaveBeenCalledTimes(1);
  notify();
  notify();
  expect(request).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(1);

  const flush = () => {
    const callback = frame;

    frame = null;

    if (callback) callback();
  };

  flush();
  expect(changed).toHaveBeenCalledTimes(1);
  width = 320;
  notify();
  expect(changed).toHaveBeenCalledTimes(1);
  flush();
  expect(changed).toHaveBeenCalledTimes(2);
  notify();
  dispose();
  expect(cancel).toHaveBeenCalledWith(7);
});
