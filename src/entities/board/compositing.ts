import { BoardConstants, type BoardItem } from "./board.types";

function orderSensitive(items: readonly BoardItem[]): boolean {
  return items.some(
    (item) =>
      item.kind === "image" ||
      item.kind === "template" ||
      item.color !== BoardConstants.INK ||
      (item.style?.opacity ?? 1) < 1,
  );
}

export const BoardCompositing = { orderSensitive };
