import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { BoardTemplates } from "~/entities/board";
import { Button } from "~/shared/ui/button";
import { PreviewScene } from "./components/preview-scene";
import { usePreviewCamera } from "./hooks/use-preview-camera";
import type { TemplatePreviewTypes } from "./template-preview.types";
import styles from "./template-preview.module.css";

export const TemplatePreview: React.FC<TemplatePreviewTypes.Props> = (
  props,
) => {
  const camera = usePreviewCamera(props.config);
  const version = BoardTemplates.version(props.config);

  return (
    <div className={styles.preview} data-kind={props.config.kind}>
      {version === 2 && (
        <div
          className={styles.modes}
          role="group"
          aria-label={I18n.t("previewZoom")}
        >
          <Button
            aria-pressed={camera.snapshot.mode === "close"}
            onClick={() => camera.choose("close")}
          >
            {I18n.t("detail")}
          </Button>
          <Button
            aria-pressed={camera.snapshot.mode === "whole"}
            onClick={() => camera.choose("whole")}
          >
            {I18n.t("fit")}
          </Button>
        </div>
      )}
      <div
        className={styles.viewport}
        role="region"
        aria-label={I18n.t("mathematicalTemplatePreview")}
        tabIndex={0}
        ref={(node) => camera.bindRegion(node)}
      >
        <svg
          ref={(node) => camera.bindSvg(node)}
          viewBox={camera.snapshot.viewBox}
          aria-label={I18n.t("templatePreview")}
          role="img"
        >
          <PreviewScene layout={BoardTemplates.layout(props.config, version)} />
        </svg>
      </div>
    </div>
  );
};
