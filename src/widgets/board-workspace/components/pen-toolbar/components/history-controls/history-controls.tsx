import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import type { HistoryControlsTypes } from "./history-controls.types";
import styles from "./history-controls.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const HistoryControls: React.FC<HistoryControlsTypes.Props> = (
  props,
) => (
  <div
    className={styles.history}
    role="group"
    aria-label={I18n.t("actionHistory")}
  >
    <Button
      aria-label={I18n.t("undo")}
      title={I18n.t("undoCtrlZ")}
      disabled={props.readOnly || !props.historyState.canUndo}
      transientDisabled={props.historyState.busy}
      onClick={props.onUndo}
    >
      <EditorIcon name="undo" />
    </Button>
    <Button
      aria-label={I18n.t("redo")}
      title={I18n.t("redoCtrlShiftZ")}
      disabled={props.readOnly || !props.historyState.canRedo}
      transientDisabled={props.historyState.busy}
      onClick={props.onRedo}
    >
      <EditorIcon name="redo" />
    </Button>
  </div>
);
