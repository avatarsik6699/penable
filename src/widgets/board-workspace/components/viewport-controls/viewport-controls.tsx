import type React from "react";
import type { ViewportControlsTypes } from "./viewport-controls.types";
import styles from "./viewport-controls.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const ViewportControls: React.FC<ViewportControlsTypes.Props> = (
  props,
) => (
  <div
    className={styles.navigation}
    role="group"
    aria-label="Масштаб доски"
    data-editor-chrome=""
  >
    <Button
      onClick={props.onZoomOut}
      aria-label="Уменьшить масштаб доски"
      title="Уменьшить масштаб доски"
      disabled={props.historyState.busy || props.diagnostics.zoom <= 0.25}
    >
      <EditorIcon name="minus" />
    </Button>
    <Button
      className={styles.value}
      onClick={props.onResetView}
      aria-label={`Масштаб ${Math.round(props.diagnostics.zoom * 100)} процентов. Вернуть исходный вид`}
      title="Вернуть 100% и исходное положение"
      disabled={props.historyState.busy}
    >
      {Math.round(props.diagnostics.zoom * 100)}
      <span>%</span>
    </Button>
    <Button
      onClick={props.onZoomIn}
      aria-label="Увеличить масштаб доски"
      title="Увеличить масштаб доски"
      disabled={props.historyState.busy || props.diagnostics.zoom >= 8}
    >
      <EditorIcon name="plus" />
    </Button>
    <span className={styles.divider} aria-hidden="true" />
    <Button
      disabled={props.selectionDisabled || props.historyState.busy}
      onClick={props.onFitAll}
      aria-label="Показать все записи"
      title="Показать все записи"
    >
      <EditorIcon name="fit" />
    </Button>
  </div>
);
