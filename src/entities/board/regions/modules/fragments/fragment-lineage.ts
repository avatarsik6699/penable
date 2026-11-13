import { type BoardItem } from "../../../board.types";

const lineages = new WeakMap<BoardItem, string>();

let sequence = 0;

const namespace = Math.random().toString(36).slice(2);

function newSource(): string {
  return `source-${namespace}-${++sequence}`;
}

function sourceOf(stroke: BoardItem): string {
  if (stroke.source) return stroke.source;

  let source = lineages.get(stroke);

  if (!source) {
    source = newSource();
    lineages.set(stroke, source);
  }

  return source;
}

export const FragmentLineage = { sourceOf, newSource };
