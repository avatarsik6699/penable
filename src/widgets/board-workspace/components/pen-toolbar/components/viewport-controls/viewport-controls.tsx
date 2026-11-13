import type React from "react";
import type { ViewportControlsTypes } from "./viewport-controls.types";
import styles from "./viewport-controls.module.css";
import { Button } from "~/shared/ui/button";

export const ViewportControls: React.FC<ViewportControlsTypes.Props> = (
  props,
) => (
  <>
    <div
      className={styles["zoom-controls"]}
      role="group"
      aria-label="Масштаб доски"
    >
      <Button
        type="button"
        onClick={props.onZoomOut}
        aria-label="Уменьшить масштаб доски"
        title="Уменьшить вокруг центра листа"
        disabled={props.historyState.busy || props.diagnostics.zoom <= 0.25}
      >
        −
      </Button>
      <Button
        type="button"
        className={styles["zoom-reset"]}
        onClick={props.onResetView}
        aria-label={`Масштаб ${Math.round(props.diagnostics.zoom * 100)} процентов. Вернуть исходный вид`}
        title="Вернуть 100% и исходное положение"
        disabled={props.historyState.busy}
      >
        {Math.round(props.diagnostics.zoom * 100)}%
      </Button>
      <Button
        type="button"
        onClick={props.onZoomIn}
        aria-label="Увеличить масштаб доски"
        title="Увеличить вокруг центра листа"
        disabled={props.historyState.busy || props.diagnostics.zoom >= 8}
      >
        +
      </Button>
    </div>
    <Button
      className={styles["fit-all"]}
      type="button"
      disabled={props.selectionDisabled || props.historyState.busy}
      onClick={props.onFitAll}
    >
      Показать все записи
    </Button>
  </>
);
