import { useRef } from "react";
import { Overlay, type OverlayElements } from "~/shared/lib/overlay";
import type { BoardMenuTypes } from "../board-menu.types";

export function useBoardTabs(props: BoardMenuTypes.Props) {
  const refs = useRef<{
    board: OverlayElements.Button | null;
    save: OverlayElements.Button | null;
  }>({ board: null, save: null });

  const keyDown: import("react").KeyboardEventHandler = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;

    event.preventDefault();

    const next =
      event.key === "Home"
        ? "board"
        : event.key === "End"
          ? "save"
          : props.tab === "board"
            ? "save"
            : "board";

    props.onTab(next);
    Overlay.focus(refs.current[next]);
  };

  return {
    bindBoard: (node: OverlayElements.Button | null) => {
      refs.current.board = node;
    },

    bindSave: (node: OverlayElements.Button | null) => {
      refs.current.save = node;
    },

    keyDown,
  };
}
