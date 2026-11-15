import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { BoardCursorViewTypes } from "./board-cursor.types";
import styles from "./board-cursor.module.css";

export const BoardCursorView: React.FC<BoardCursorViewTypes.Props> = (
  props,
) => (
  <>
    <div
      data-testid="board-cursor"
      ref={(node) => {
        props.bindCursor(node);
      }}
      className={styles["board-cursor"]}
      hidden
      aria-hidden="true"
    >
      <svg className={styles["cursor-arrow"]} viewBox="0 0 24 28">
        <path d="M2 2v21l6-6 5 9 4-2-5-9h9Z" />
      </svg>
      <svg className={styles["cursor-move"]} viewBox="0 0 24 24">
        <path d="M12 1 8 5h3v6H5V8l-4 4 4 4v-3h6v6H8l4 4 4-4h-3v-6h6v3l4-4-4-4v3h-6V5h3Z" />
      </svg>
      <span className={styles["cursor-dot"]} />
      <span className={styles["cursor-eraser"]} />
      <svg
        className={[styles["cursor-hand"], styles["cursor-hand-open"]].join(
          " ",
        )}
        viewBox="0 0 24 24"
      >
        <path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-3a1.5 1.5 0 0 1 3 0v6c0 4-3 7-7 7h-1c-2 0-4-1-5-3l-4-6a1.5 1.5 0 0 1 2.4-1.8L8 14Z" />
      </svg>
      <svg
        className={[styles["cursor-hand"], styles["cursor-hand-closed"]].join(
          " ",
        )}
        viewBox="0 0 24 24"
      >
        <path d="M7 12V9a1.5 1.5 0 0 1 3 0v2-3a1.5 1.5 0 0 1 3 0v3-2a1.5 1.5 0 0 1 3 0v3-1a1.5 1.5 0 0 1 3 0v5c0 4-3 6-6 6h-1c-2 0-4-1-5-3l-3-5a1.5 1.5 0 0 1 2.5-1.6L7 14Z" />
      </svg>
    </div>
    <span
      ref={(node) => {
        props.bindFocusBadge(node);
      }}
      className={styles["canvas-focus-badge"]}
      hidden
    >
      {I18n.t("canvas")}
    </span>
  </>
);
