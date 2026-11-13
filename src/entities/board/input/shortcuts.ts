export type HistoryAction = "undo" | "redo";

type HistoryKeyEvent = {
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  defaultPrevented: boolean;
};

type HistoryContext = {
  editable: boolean;
  inkPointerId: number | null;
  panPointerId: number | null;
};

function pointerInputBusy(context: HistoryContext): boolean {
  return context.inkPointerId !== null || context.panPointerId !== null;
}

function historyShortcut(
  event: HistoryKeyEvent,
  context: HistoryContext,
): {
  action: HistoryAction;
  blocked: boolean;
} | null {
  if (
    event.code !== "KeyZ" ||
    (!event.ctrlKey && !event.metaKey) ||
    event.altKey ||
    event.isComposing ||
    event.defaultPrevented ||
    context.editable
  )
    return null;

  return {
    action: event.shiftKey ? "redo" : "undo",
    blocked: pointerInputBusy(context),
  };
}

function selectionNudgeShortcut(
  event: HistoryKeyEvent,
  context: HistoryContext,
): {
  x: number;
  y: number;
  blocked: boolean;
} | null {
  if (
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.isComposing ||
    event.defaultPrevented ||
    context.editable
  )
    return null;

  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };

  const direction = directions[event.code];

  if (!direction) return null;

  const step = event.shiftKey ? 10 : 1;

  return {
    x: direction[0] * step,
    y: direction[1] * step,
    blocked: pointerInputBusy(context),
  };
}

export const BoardShortcuts = { historyShortcut, selectionNudgeShortcut };
