import { afterEach, describe, expect, it, vi } from "vitest";
import { BoardPNG } from "./png";
import { BoardViewport } from "~/entities/board";
import { type Stroke, BoardConstants } from "~/entities/board";
import { BoardRegions } from "~/entities/board";
describe("vector PNG and fit visible ink", () => {
  it("uses 2 pixels per world unit and transparent edge padding independently of viewport", () => {
    expect(
      BoardPNG.pngDimensions({ left: -10, top: 50, right: 10, bottom: 60 }),
    ).toEqual({ width: 44, height: 24 });
  });
  it("rejects side and pixel budgets instead of reducing resolution", () => {
    expect(() =>
      BoardPNG.pngDimensions({ left: 0, top: 0, right: 5000, bottom: 1 }),
    ).toThrow("8192");
    expect(() =>
      BoardPNG.pngDimensions({ left: 0, top: 0, right: 3000, bottom: 3000 }),
    ).toThrow("16 777 216");
  });
  it("fits only the visible fragment with 48 CSS px padding, clamps zoom, resets empty scenes", () => {
    const stroke: Stroke = {
      id: 1,
      color: BoardConstants.INK,
      width: 2,
      points: [
        { x: -100000, y: 0, time: 0, pressure: 0.5 },
        { x: 100000, y: 0, time: 1, pressure: 0.5 },
      ],
      source: "line",
      clip: BoardRegions.rectangle({ x: 0, y: -10 }, { x: 100, y: 10 }),
    };
    const viewport = BoardViewport.fitAll([stroke], 496, 300);
    expect(viewport.zoom).toBe(4);
    expect(viewport.x).toBe(48);
    expect(BoardViewport.fitAll([], 496, 300)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(BoardViewport.fitAll([stroke], 10000, 10000).zoom).toBe(8);
  });
});
afterEach(() => vi.unstubAllGlobals());
describe("PNG browser boundaries", () => {
  it("renders vectors into a separate transparent bitmap and releases it after encoding", async () => {
    const context = {
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 0,
      lineCap: "",
      lineJoin: "",
    };
    let encodedSize = [0, 0];
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: (done: BlobCallback) => {
        encodedSize = [canvas.width, canvas.height];
        done(new Blob(["png"], { type: "image/png" }));
      },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    const dot: Stroke = {
      id: 1,
      color: BoardConstants.INK,
      width: 2,
      points: [{ x: 10, y: 20, time: 0, pressure: 1 }],
    };
    const blob = await BoardPNG.selectionPNG([dot]);
    expect(blob.type).toBe("image/png");
    expect(encodedSize).toEqual([8, 8]);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, -16, -36);
    expect(context.arc).toHaveBeenCalledWith(10, 20, 1, 0, Math.PI * 2);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
  it("releases a failed PNG bitmap and rejects clipboard exceptions without touching source data", async () => {
    const canvas = { width: 0, height: 0, getContext: () => null };
    vi.stubGlobal("document", { createElement: () => canvas });
    const dot: Stroke = {
      id: 1,
      color: BoardConstants.INK,
      width: 2,
      points: [{ x: 0, y: 0, time: 0, pressure: 1 }],
    };
    await expect(BoardPNG.selectionPNG([dot])).rejects.toThrow("Canvas 2D");
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(dot.points).toHaveLength(1);
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor() {
          throw new Error("denied");
        }
      },
    );
    vi.stubGlobal("navigator", { clipboard: { write: vi.fn() } });
    await expect(
      BoardPNG.writePNG(Promise.resolve(new Blob())),
    ).rejects.toThrow("denied");
  });
  it("hands a deferred image/png Blob to the write API directly in the user action", async () => {
    const write = vi.fn(async () => {});
    let supplied: Record<string, unknown> = {};
    vi.stubGlobal(
      "ClipboardItem",
      class {
        constructor(data: Record<string, unknown>) {
          supplied = data;
        }
      },
    );
    vi.stubGlobal("navigator", { clipboard: { write } });
    const png = Promise.resolve(new Blob(["png"], { type: "image/png" }));
    const writing = BoardPNG.writePNG(png);
    expect(write).toHaveBeenCalledOnce();
    expect(supplied["image/png"]).toBe(png);
    await writing;
  });
});
describe("explicit PNG selection area", () => {
  it("preserves selected whitespace and clips to the exact area without outside padding", async () => {
    const context = {
      setTransform: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
    };
    let encodedSize: number[] = [];
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
      toBlob: (done: BlobCallback) => {
        encodedSize = [canvas.width, canvas.height];
        done(new Blob(["png"]));
      },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    const dot: Stroke = {
      id: 1,
      color: BoardConstants.INK,
      width: 2,
      points: [{ x: 10, y: 20, time: 0, pressure: 1 }],
    };
    await BoardPNG.selectionPNG(
      [dot],
      BoardRegions.rectangle({ x: -20, y: -10 }, { x: 80, y: 90 }),
    );
    expect(encodedSize).toEqual([200, 200]);
    expect(context.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 40, 20);
    expect(context.clip).toHaveBeenCalledWith("nonzero");
    expect(canvas.width).toBe(0);
  });
});
