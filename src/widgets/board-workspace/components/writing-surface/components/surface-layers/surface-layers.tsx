import type React from "react";
import type { SurfaceLayersTypes } from "./surface-layers.types";
import styles from "./surface-layers.module.css";

export const SurfaceLayers: React.FC<SurfaceLayersTypes.Props> = (props) => (
  <>
    <div
      ref={(node) => {
        props.bindBackground(node);
      }}
      className={styles["board-background"]}
      data-background={props.background}
      aria-hidden="true"
    />
    <canvas
      ref={(node) => {
        props.bindCompleted(node);
      }}
      className={styles["completed-canvas"]}
      data-layer="completed"
      data-testid="board-completed"
      aria-hidden="true"
    />
    <canvas
      ref={(node) => {
        props.bindCanvas(node);
      }}
      className={styles["live-canvas"]}
      data-tool={props.tool}
      data-layer="live"
      data-testid="board-live"
      tabIndex={0}
      aria-label="Область письма и стирания пером или основной кнопкой мыши"
      aria-describedby="prototype-warning writing-help"
    >
      Для письма нужен браузер с поддержкой Canvas 2D.
    </canvas>
    <svg
      data-testid="board-selection"
      className={styles["selection-outline"]}
      aria-hidden="true"
    >
      <path
        ref={(node) => {
          props.bindSelectionPath(node);
        }}
      />
    </svg>
  </>
);
