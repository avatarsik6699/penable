import type React from "react";
import type { ToolControlsTypes } from "./tool-controls.types";
import styles from "./tool-controls.module.css";
import { Button } from "~/shared/ui/button";

export const ToolControls: React.FC<ToolControlsTypes.Props> = (props) => (
  <div className={styles["tool-controls"]} role="group" aria-label="Инструмент">
    <Button
      type="button"
      aria-pressed={props.tool === "pen"}
      onClick={() => props.onToolChange("pen")}
      disabled={props.readOnly || props.historyState.busy}
    >
      Перо
    </Button>
    <Button
      type="button"
      aria-pressed={props.tool === "eraser"}
      onClick={() => props.onToolChange("eraser")}
      title="Удаляет штрих целиком"
      disabled={props.readOnly || props.historyState.busy}
    >
      Ластик
    </Button>
    <Button
      type="button"
      aria-pressed={props.tool === "selection"}
      onClick={() => props.onToolChange("selection")}
      disabled={props.selectionDisabled || props.historyState.busy}
    >
      Выделение
    </Button>
  </div>
);
