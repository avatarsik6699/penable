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
    {props.navigationMessage && (
      <p className={styles.notice} role="status">
        {props.navigationMessage}
      </p>
    )}
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
      aria-label={`Масштаб ${Math.round(props.diagnostics.zoom * 100)} процентов. Установить 100%`}
      title="Установить 100% вокруг центра экрана"
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
      disabled={
        props.selectionDisabled ||
        props.historyState.busy ||
        !props.canReturnWriting
      }
      onClick={props.onReturnWriting}
      aria-label="К месту письма"
      title={
        props.canReturnWriting
          ? "Вернуться к последнему рабочему виду"
          : "Завершите штрих, чтобы запомнить место письма"
      }
    >
      <EditorIcon name="writing-return" />
    </Button>
    <Button
      ref={(node) => props.bindMinimapTrigger(node)}
      aria-label="Миникарта"
      title="Миникарта"
      aria-expanded={props.minimapOpen}
      aria-controls="board-minimap-panel"
      disabled={props.selectionDisabled}
      onClick={props.onMinimapToggle}
    >
      <EditorIcon name="map" />
    </Button>
  </div>
);
