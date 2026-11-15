import { I18n } from "~/shared/lib/i18n";
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
    aria-label={I18n.t("boardMinimap")}
    aria-busy="true"
    id="board-minimap-panel"
  >
    <div className={styles.heading}>
      <h2>{I18n.t("minimap")}</h2>
      <Button aria-label={I18n.t("closeMinimap")} onClick={props.onClose}>
        <EditorIcon name="close" />
      </Button>
    </div>
    <button
      ref={(node) => props.bindMapArea(node)}
      className={styles.area}
      type="button"
      aria-label={I18n.t("goToBoardArea")}
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
      {I18n.t("updatingOverview")}
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
      aria-label={I18n.t("fitAllContent")}
    >
      {I18n.t("fitAllContent")}
    </Button>
    <p className={styles.keyboard}>
      {I18n.t("arrowKeysPanTheViewEnterCenters")}
    </p>
  </div>
);
