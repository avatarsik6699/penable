import type { BoardItem, ClipMask, Position, TextItem } from "./board.types";
import { BoardTransforms } from "./transforms";

const FONT_SIZE = 20;
const LINE_HEIGHT = 28;
const MIN_WIDTH = 1;
const MAX_WIDTH = 600;
const MAX_LENGTH = 8000;
const MAX_LINES = 256;
const MAX_BYTES = 1048576;

function validLayout({
  text,
  width,
  lines,
}: Pick<TextItem, "text" | "width" | "lines">): boolean {
  if (
    text.length > MAX_LENGTH ||
    !text.trim() ||
    text.includes("\r") ||
    !Number.isFinite(width) ||
    width < MIN_WIDTH ||
    width > MAX_WIDTH ||
    lines[0] !== 0 ||
    lines.length > MAX_LINES
  )
    return false;

  let previous = -1;
  let newline = text.indexOf("\n");

  for (const start of lines) {
    if (
      !Number.isInteger(start) ||
      start <= previous ||
      start > text.length ||
      (start === text.length && text.at(-1) !== "\n") ||
      (start > 0 && start === newline && text[start - 1] !== "\n") ||
      (newline !== -1 && start > newline + 1)
    )
      return false;

    const before = text.charCodeAt(start - 1);
    const after = text.charCodeAt(start);

    if (
      before >= 0xd800 &&
      before <= 0xdbff &&
      after >= 0xdc00 &&
      after <= 0xdfff
    )
      return false;

    if (newline !== -1 && start === newline + 1)
      newline = text.indexOf("\n", start);

    previous = start;
  }

  return newline === -1;
}

function localBounds(item: Pick<TextItem, "width" | "lines">) {
  return {
    left: 0,
    top: 0,
    right: item.width,
    bottom: item.lines.length * LINE_HEIGHT,
  };
}

function mask(item: TextItem): ClipMask {
  const { right, bottom } = localBounds(item);

  return BoardTransforms.mask(
    [
      [
        [
          [0, 0],
          [right, 0],
          [right, bottom],
          [0, bottom],
          [0, 0],
        ],
      ],
    ],
    item.matrix,
  );
}

function contains(item: TextItem, point: Position): boolean {
  const { x, y } = BoardTransforms.point(
    BoardTransforms.inverse(item.matrix),
    point,
  );

  const { right, bottom } = localBounds(item);

  return x >= 0 && x <= right && y >= 0 && y <= bottom;
}

function atPoint(
  items: readonly BoardItem[],
  point: Position,
): TextItem | null {
  for (let index = items.length - 1; index >= 0; index--) {
    const item = items[index]!;

    if (item.kind === "text" && contains(item, point)) return item;
  }

  return null;
}

export const BoardText = {
  fontSize: FONT_SIZE,
  lineHeight: LINE_HEIGHT,
  minWidth: MIN_WIDTH,
  maxWidth: MAX_WIDTH,
  maxLength: MAX_LENGTH,
  maxLines: MAX_LINES,
  maxBytes: MAX_BYTES,
  validLayout,
  localBounds,
  mask,
  atPoint,
};
