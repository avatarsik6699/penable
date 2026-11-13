import type React from "react";
import type { MinimapViewTypes } from "./minimap-view.types";
import styles from "./minimap-view.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";

export const MinimapView: React.FC<MinimapViewTypes.Props> = (props) => (
  <div
    ref={(node) => props.bindRoot(node)}
    className={styles.panel}
    role="region"
    aria-label="Миникарта доски"
    aria-busy="true"
    id="board-minimap-panel"
  >
    <div className={styles.heading}>
      <h2>Миникарта</h2>
      <Button aria-label="Закрыть миникарту" onClick={props.onClose}>
        <EditorIcon name="close" />
      </Button>
    </div>
    <button
      ref={(node) => props.bindMapArea(node)}
      className={styles.area}
      type="button"
      aria-label="Перейти к участку доски"
      aria-describedby="minimap-help"
    >
      <canvas
        ref={(node) => props.bindMapCanvas(node)}
        data-testid="board-minimap"
        width="256"
        height="160"
        aria-hidden="true"
      />
      <svg viewBox="0 0 256 160" aria-hidden="true">
        <rect ref={(node) => props.bindMapFrame(node)} visibility="hidden" />
        <circle
          ref={(node) => props.bindMapMarker(node)}
          r="3"
          visibility="hidden"
        />
      </svg>
    </button>
    <p
      ref={(node) => props.bindMapStatus(node)}
      id="minimap-help"
      role="status"
    >
      Обновление обзора…
    </p>
    <p
      ref={(node) => props.bindMapOutside(node)}
      className={styles.outside}
      hidden
    />
    <Button
      ref={(node) => props.bindMapFit(node)}
      className={styles.fit}
      disabled
      aria-label="Показать все записи"
    >
      Показать все записи
    </Button>
    <p className={styles.keyboard}>
      Стрелки перемещают вид, Enter — к центру обзора.
    </p>
  </div>
);
