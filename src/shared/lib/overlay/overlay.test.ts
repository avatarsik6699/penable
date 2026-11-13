import { afterEach, describe, it, expect, vi } from "vitest";
import { Overlay } from "./overlay";

function setup(top = 312) {
  let panelTop = top;

  const values = new Map<string, string>(),
    ancestor = { parentElement: null },
    panel = {
      parentElement: ancestor,
      getBoundingClientRect: () => ({ top: panelTop }),
      style: {
        getPropertyValue: (key: string) => values.get(key) ?? "",
        setProperty: vi.fn((key: string, value: string) => {
          values.set(key, value);
        }),
        removeProperty: vi.fn((key: string) => {
          values.delete(key);
        }),
      },
    };

  const viewport = Object.assign(new EventTarget(), {
      height: 845,
      offsetTop: 0,
    }),
    host = Object.assign(new EventTarget(), {
      innerHeight: 845,
      visualViewport: viewport,
    });

  let resized: () => void = () => {};

  const observe = vi.fn(),
    disconnect = vi.fn();

  vi.stubGlobal("window", host);

  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resized = callback;
      }

      observe = observe;
      disconnect = disconnect;
    },
  );

  return {
    panel: panel as unknown as HTMLElement,
    values,
    viewport,
    host,
    observe,
    disconnect,
    style: panel.style,
    resize: () => resized(),

    move: (top: number) => {
      panelTop = top;
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("panel available viewport geometry", () => {
  it("uses the measured panel top so the complete scroll box ends inside the bottom inset", () => {
    const h = setup(312),
      unbind = Overlay.bindViewport(h.panel),
      height = Number.parseInt(h.values.get("--panel-available-height")!);

    expect(height).toBe(521);
    expect(312 + height).toBe(845 - 12);
    expect(h.observe).toHaveBeenCalledTimes(2);
    unbind();
  });

  it("recomputes after compact layout movement, viewport resize and keyboard viewport offsets", () => {
    const h = setup(),
      unbind = Overlay.bindViewport(h.panel);

    h.move(380);
    h.resize();
    expect(h.values.get("--panel-available-height")).toBe("453px");
    h.viewport.height = 568;
    h.viewport.dispatchEvent(new Event("resize"));
    expect(h.values.get("--panel-available-height")).toBe("176px");
    h.viewport.height = 400;
    h.viewport.offsetTop = 100;
    h.viewport.dispatchEvent(new Event("scroll"));
    expect(h.values.get("--panel-available-height")).toBe("108px");
    unbind();
  });

  it("does not make a negative height and cleans observers, listeners and inline state on close", () => {
    const h = setup(900);

    h.values.set("--panel-available-height", "200px");

    const windowRemove = vi.spyOn(h.host, "removeEventListener"),
      viewportRemove = vi.spyOn(h.viewport, "removeEventListener"),
      unbind = Overlay.bindViewport(h.panel);

    expect(h.values.get("--panel-available-height")).toBe("0px");

    const writes = h.style.setProperty.mock.calls.length;

    h.resize();
    expect(h.style.setProperty).toHaveBeenCalledTimes(writes);
    unbind();
    expect(h.disconnect).toHaveBeenCalledOnce();
    expect(windowRemove).toHaveBeenCalledTimes(2);
    expect(viewportRemove).toHaveBeenCalledTimes(2);
    expect(h.values.get("--panel-available-height")).toBe("200px");
    h.resize();
    expect(h.values.get("--panel-available-height")).toBe("200px");
  });

  it("uses the layout viewport when VisualViewport is unavailable", () => {
    const h = setup(200);

    vi.stubGlobal(
      "window",
      Object.assign(new EventTarget(), { innerHeight: 568 }),
    );

    const unbind = Overlay.bindViewport(h.panel);

    expect(h.values.get("--panel-available-height")).toBe("356px");
    unbind();

    expect(h.style.removeProperty).toHaveBeenCalledWith(
      "--panel-available-height",
    );
  });
});
