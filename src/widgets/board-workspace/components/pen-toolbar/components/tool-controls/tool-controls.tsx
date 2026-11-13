import type React from "react";
import type { ToolControlsTypes } from "./tool-controls.types";
import styles from "./tool-controls.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const ToolControls: React.FC<ToolControlsTypes.Props> = (props) => (
  <div className={styles.tools} role="group" aria-label="Инструмент">
    <Button
      ref={(node) => {
        props.bindPenTrigger(node);
      }}
      aria-label="Перо"
      title="Перо · повторно — параметры"
      aria-pressed={props.tool === "pen"}
      aria-haspopup="dialog"
      aria-expanded={props.penOpen}
      aria-controls="pen-panel"
      disabled={props.readOnly || props.historyState.busy}
      onClick={() =>
        props.tool === "pen"
          ? props.onPenParameters()
          : props.onToolChange("pen")
      }
    >
      <EditorIcon name="pen" />
      <span className={styles.chevron}>
        <EditorIcon name="chevron-down" />
      </span>
    </Button>
    <Button
      aria-label="Ластик"
      title="Ластик: штрих целиком"
      aria-pressed={props.tool === "eraser"}
      onClick={() => props.onToolChange("eraser")}
      disabled={props.readOnly || props.historyState.busy}
    >
      <EditorIcon name="eraser" />
    </Button>
    <Button
      aria-label="Выделение"
      title="Выделение"
      aria-pressed={props.tool === "selection"}
      onClick={() => props.onToolChange("selection")}
      disabled={props.selectionDisabled || props.historyState.busy}
    >
      <EditorIcon name="selection" />
    </Button>
  </div>
);
