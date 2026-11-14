import { describe, expect, it } from "vitest";
import { BoardTemplates } from "~/entities/board";
import { PreviewCamera } from "./preview-camera";

describe("local mathematical preview camera", () => {
  it("starts around zero with readable uniform units, fits the full figure on demand, and pans without scale jumps", () => {
    const config = {
      ...BoardTemplates.defaults("axes"),
      min: -100,
      max: 100,
      step: 1,
    };

    const before = JSON.stringify(config),
      camera = new PreviewCamera(config);

    camera.resize(280, 240);

    const close = camera.snapshot;

    expect(close.mode).toBe("close");
    expect(close.viewBox.split(" ").slice(2).map(Number)).toEqual([280, 240]);
    camera.choose("whole");

    const whole = camera.snapshot.viewBox.split(" ").map(Number);

    expect(whole[2]).toBeGreaterThan(8000);
    camera.pan(20, 10);

    const panned = camera.snapshot.viewBox.split(" ").map(Number);

    expect(panned[2]).toBe(whole[2]);
    expect(panned[3]).toBe(whole[3]);
    expect(panned[0]).toBeCloseTo(whole[0]! - (20 * whole[2]!) / 280);
    camera.choose("close");
    expect(camera.snapshot).toEqual(close);
    expect(JSON.stringify(config)).toBe(before);
  });
});
