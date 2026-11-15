import { I18n } from "~/shared/lib/i18n";
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
      aria-label={I18n.t("writingAndErasingSurfaceForPenOr")}
      aria-describedby="prototype-warning writing-help"
    >
      {I18n.t("writingNeedsABrowserWithCanvas2d")}
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
      <path
        ref={(node) => props.bindSelectionHandles(node)}
        data-testid="selection-handles"
        style={{ strokeDasharray: "none", fill: "var(--paper)" }}
      />
    </svg>
  </>
);
