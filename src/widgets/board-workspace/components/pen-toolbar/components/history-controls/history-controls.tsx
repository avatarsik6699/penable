import type React from "react";
import type { HistoryControlsTypes } from "./history-controls.types";
import styles from "./history-controls.module.css";
import { Button } from "~/shared/ui/button";

export const HistoryControls: React.FC<HistoryControlsTypes.Props> = (
  props,
) => (
  <div
    className={styles["history-controls"]}
    role="group"
    aria-label="История штрихов"
  >
    <Button
      type="button"
      onClick={props.onUndo}
      aria-label="Отменить действие"
      title="Отменить действие (Ctrl+Z / ⌘Z)"
      disabled={
        props.readOnly || props.historyState.busy || !props.historyState.canUndo
      }
    >
      ↶
    </Button>
    <Button
      type="button"
      onClick={props.onRedo}
      aria-label="Вернуть действие"
      title="Вернуть действие (Ctrl+Shift+Z / ⌘Shift+Z)"
      disabled={
        props.readOnly || props.historyState.busy || !props.historyState.canRedo
      }
    >
      ↷
    </Button>
  </div>
);
