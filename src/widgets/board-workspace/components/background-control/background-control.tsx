import { Messages } from "~/shared/lib/messages";
import { I18n } from "~/shared/lib/i18n";
import { RangeInput } from "~/shared/ui/range-input";
import type React from "react";
import type { BackgroundControlTypes } from "./background-control.types";
import styles from "./background-control.module.css";
import type { BackgroundMode } from "~/entities/board";

export const BackgroundControl: React.FC<BackgroundControlTypes.Props> = (
  props,
) => (
  <div className={styles.root}>
    <h3>{I18n.t("boardBackground")}</h3>
    <div
      className={styles.options}
      role="group"
      aria-label={I18n.t("boardBackground")}
    >
      {(["blank", "dots", "grid"] as BackgroundMode[]).map((mode) => (
        <button
          type="button"
          key={mode}
          aria-pressed={props.background === mode}
          disabled={props.readOnly}
          onClick={() => props.onBackgroundChange(mode)}
        >
          <span
            aria-hidden="true"
            className={[styles.preview, styles[mode]].join(" ")}
          />
          <span>
            {I18n.text(
              mode === "blank"
                ? Messages.create("blank")
                : mode === "dots"
                  ? Messages.create("dots")
                  : Messages.create("grid"),
            )}
          </span>
        </button>
      ))}
    </div>
    {props.background !== "blank" && (
      <div className={styles.settings}>
        <label htmlFor="background-contrast">
          {I18n.t("backgroundContrast")}{" "}
          <output>{props.settings.contrast}%</output>
        </label>
        <RangeInput
          id="background-contrast"
          aria-label={I18n.t("backgroundContrast")}
          aria-valuetext={I18n.text(`${props.settings.contrast}%`)}
          min="0"
          max="100"
          step="1"
          value={props.settings.contrast}
          disabled={props.readOnly}
          onChange={(event) =>
            props.onSettingsChange({
              ...props.settings,
              contrast: Number(event.target.value),
            })
          }
        />
        <label htmlFor="background-spacing">
          {I18n.t("backgroundSpacing")}{" "}
          <output>{props.settings.spacing}</output>
        </label>
        <RangeInput
          id="background-spacing"
          aria-label={I18n.t("backgroundSpacing")}
          aria-valuetext={I18n.text(
            Messages.create("valueBoardUnits", { p0: props.settings.spacing }),
          )}
          min="12"
          max="64"
          step="2"
          value={props.settings.spacing}
          disabled={props.readOnly}
          onChange={(event) =>
            props.onSettingsChange({
              ...props.settings,
              spacing: Number(event.target.value),
            })
          }
        />
        <p>{I18n.t("theBackgroundBecomesCoarserWhenZoomedOut")}</p>
      </div>
    )}
  </div>
);
