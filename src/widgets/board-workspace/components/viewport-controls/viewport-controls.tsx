import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
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
    aria-label={I18n.t("boardZoom")}
    data-editor-chrome=""
  >
    {props.navigationMessage && (
      <p className={styles.notice} role="status">
        {I18n.text(props.navigationMessage)}
      </p>
    )}
    <Button
      onClick={props.onZoomOut}
      aria-label={I18n.t("zoomOutBoard")}
      title={I18n.t("zoomOutBoard")}
      disabled={props.historyState.busy || props.diagnostics.zoom <= 0.25}
    >
      <EditorIcon name="minus" />
    </Button>
    <Button
      className={styles.value}
      onClick={props.onResetView}
      aria-label={I18n.text(
        Messages.create("zoomValuePercentSetTo100", {
          p0: Math.round(props.diagnostics.zoom * 100),
        }),
      )}
      title={I18n.t("set100AroundTheScreenCenter")}
      disabled={props.historyState.busy}
    >
      {Math.round(props.diagnostics.zoom * 100)}
      <span>%</span>
    </Button>
    <Button
      onClick={props.onZoomIn}
      aria-label={I18n.t("zoomInBoard")}
      title={I18n.t("zoomInBoard")}
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
      aria-label={I18n.t("returnToWriting")}
      title={I18n.text(
        props.canReturnWriting
          ? Messages.create("returnToTheLastWritingView")
          : Messages.create("finishAStrokeToRememberYourWriting"),
      )}
    >
      <EditorIcon name="writing-return" />
    </Button>
    <Button
      ref={(node) => props.bindMinimapTrigger(node)}
      aria-label={I18n.t("minimap")}
      title={I18n.t("minimap")}
      aria-expanded={props.minimapOpen}
      aria-controls="board-minimap-panel"
      disabled={props.selectionDisabled}
      onClick={props.onMinimapToggle}
    >
      <EditorIcon name="map" />
    </Button>
  </div>
);
