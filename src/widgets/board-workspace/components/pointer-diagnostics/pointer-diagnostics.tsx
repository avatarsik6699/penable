import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import styles from "./pointer-diagnostics.module.css";
import type React from "react";
import type { PointerDiagnosticsTypes } from "./pointer-diagnostics.types";

export const PointerDiagnostics: React.FC<PointerDiagnosticsTypes.Props> = (
  props,
) => {
  return (
    <div className={styles["diagnostics"]}>
      <div className={styles["diagnostics-panel"]}>
        <dl>
          <div>
            <dt>{I18n.t("pointer")}</dt>
            <dd>
              {I18n.text(
                props.diagnostics.pointerType === "unknown"
                  ? Messages.create("notSpecified")
                  : (props.diagnostics.pointerType ??
                      Messages.create("waitingForInput")),
              )}
            </dd>
          </div>
          <div>
            <dt>{I18n.t("pressure")}</dt>
            <dd>{I18n.text(props.diagnostics.pressure?.toFixed(3) ?? "—")}</dd>
          </div>
          <div>
            <dt>{I18n.t("stroke")}</dt>
            <dd>
              {I18n.text(
                props.diagnostics.active
                  ? Messages.create("writing376")
                  : Messages.create("inactive"),
              )}
            </dd>
          </div>
          <div>
            <dt>DPR</dt>
            <dd>{props.diagnostics.dpr}</dd>
          </div>
          <div>
            <dt>Coalesced events</dt>
            <dd>
              {I18n.text(
                props.diagnostics.coalesced
                  ? Messages.create("available")
                  : Messages.create("standardEvents"),
              )}
            </dd>
          </div>
          <div>
            <dt>{I18n.t("boardZoom")}</dt>
            <dd>{Math.round(props.diagnostics.zoom * 100)}%</dd>
          </div>
          <div>
            <dt>{I18n.t("pinchScale")}</dt>
            <dd>{I18n.text(props.diagnostics.nativeScale.toFixed(2))}×</dd>
          </div>
          <div>
            <dt>{I18n.t("resolution")}</dt>
            <dd>
              {I18n.text(props.diagnostics.effectiveRatio.toFixed(2))}× /
              {I18n.text(" ")}
              {I18n.text(props.diagnostics.requestedRatio.toFixed(2))}×
            </dd>
          </div>
          <div>
            <dt>{I18n.t("eachLayer")}</dt>
            <dd>
              {props.diagnostics.bitmapWidth} × {props.diagnostics.bitmapHeight}
              {I18n.text(" ")}
              px
            </dd>
          </div>
        </dl>
        <p
          className={
            props.diagnostics.resolutionCapped
              ? styles["resolution-limit"]
              : undefined
          }
        >
          {I18n.text(
            props.diagnostics.resolutionCapped
              ? Messages.create("resolutionLimitReached168MillionPixels")
              : Messages.create("resolutionEffectiveRequestedTwoLayersUpTo"),
          )}
        </p>
        <p>{I18n.t("pressureComesFromTheEventTheRegular")}</p>
      </div>
    </div>
  );
};
