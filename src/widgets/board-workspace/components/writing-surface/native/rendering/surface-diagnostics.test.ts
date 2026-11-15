import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceDiagnostics } from "./surface-diagnostics";
import type { InputDiagnostics } from "../../../../model/workspace-model.types";

function setup() {
  vi.useFakeTimers();

  const initial: InputDiagnostics = {
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

  let owner: number | null = null;
  const publish = vi.fn();
  const diagnostics = new SurfaceDiagnostics(initial, publish, () => owner);

  return {
    diagnostics,
    publish,

    own: (pointerId: number) => {
      owner = pointerId;
    },
  };
}

function pen(type: string, overrides: Partial<PointerEvent> = {}) {
  return {
    type,
    pointerType: "pen",
    pointerId: 7,
    isPrimary: true,
    button: 0,
    buttons: 1,
    pressure: 0.5,
    ...overrides,
  } as PointerEvent;
}

afterEach(() => vi.useRealTimers());

describe("native pen contact diagnostics", () => {
  it("retains the rejected contact flags across later hover and cancellation", () => {
    const h = setup();

    h.diagnostics.observe(pen("pointerdown", { isPrimary: false, buttons: 3 }));
    h.diagnostics.observe(pen("pointermove", { button: -1, buttons: 0 }));
    h.diagnostics.observe();
    expect(h.publish).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);

    expect(h.publish).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        active: false,
        inputEvent: "pointermove",
        lastPenContact:
          "pointerdown id=7 button=0 buttons=3 primary=false accepted=false",
      }),
    );

    h.diagnostics.dispose();
  });

  it("records acceptance of a fresh contact transition without pointerdown", () => {
    const h = setup();

    h.own(7);
    h.diagnostics.observe(pen("pointermove"));
    h.diagnostics.observe(pen("pointerup", { buttons: 0 }));
    vi.advanceTimersByTime(100);

    expect(h.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        lastPenContact:
          "pointermove id=7 button=0 buttons=1 primary=true accepted=true",
      }),
    );

    h.diagnostics.dispose();
  });

  it("does not publish a pending update after disposal", () => {
    const h = setup();

    h.diagnostics.observe(pen("pointerdown"));
    h.diagnostics.dispose();
    vi.runAllTimers();
    expect(h.publish).not.toHaveBeenCalled();
  });
});
