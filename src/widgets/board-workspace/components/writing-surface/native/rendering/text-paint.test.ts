import { describe, expect, it, vi } from "vitest";
import { BoardText, type TextItem } from "~/entities/board";
import { TextPaint } from "./text-paint";
import type { RenderingContext } from "./rendering-context.types";

function context() {
  return {
    font: "",
    save: vi.fn(),
    restore: vi.fn(),
    fillText: vi.fn(),
    measureText: (line: string) => ({ width: Array.from(line).length }),
  };
}

describe("board text layout and paint", () => {
  it("keeps explicit paragraphs, wraps words and preserves a joined emoji", () => {
    const canvas = context();
    const original = "ab cd\r\n\r\n👩‍🔬Z\n";

    const layout = TextPaint.layout(
      canvas as unknown as RenderingContext,
      original,
      3,
    );

    expect(layout.text).toBe("ab cd\n\n👩‍🔬Z\n");
    expect(layout.lines).toEqual([0, 3, 6, 7, 12, 14]);
    expect(BoardText.validLayout(layout)).toBe(true);
    expect(canvas.restore).toHaveBeenCalledOnce();
  });

  it("draws the persisted line positions and skips blank lines", () => {
    const canvas = context();

    const item: TextItem = {
      kind: "text",
      id: 1,
      text: "Первая\n\nВторая",
      width: 220,
      lines: [0, 7, 8],
      matrix: [1, 0, 0, 1, 0, 0],
    };

    TextPaint.paint(canvas as unknown as RenderingContext, item, "light");

    expect(canvas.fillText.mock.calls).toEqual([
      ["Первая", 0, 20, 220],
      ["Вторая", 0, 76, 220],
    ]);
  });

  it("rejects empty text and length or layout overflow before committing", () => {
    const canvas = context() as unknown as RenderingContext;

    expect(() => TextPaint.layout(canvas, " \n\t ", 300)).toThrow();
    expect(() => TextPaint.layout(canvas, "a".repeat(8001), 300)).toThrow();
    expect(() => TextPaint.layout(canvas, "a\n".repeat(256), 300)).toThrow();
  });
});
