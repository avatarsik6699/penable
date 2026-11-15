import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { useId } from "react";
import { Button } from "~/shared/ui/button";
import type { MathSettingsTypes } from "./math-settings.types";
import styles from "./math-settings.module.css";

export const MathSettings: React.FC<MathSettingsTypes.Props> = (props) => {
  const id = useId();

  return (
    <fieldset className={styles.settings} disabled={props.disabled}>
      <legend>{I18n.t("rangeAndTicks")}</legend>
      <div className={styles.fields}>
        <label>
          {I18n.t("from")}
          <input
            type="text"
            inputMode="decimal"
            value={props.state.fields.min}
            aria-invalid={props.state.error?.field === "min" || undefined}
            aria-describedby={
              props.state.error?.field === "min" ? `${id}-error` : undefined
            }
            onChange={(event) => props.onField("min", event.target.value)}
          />
        </label>
        <label>
          {I18n.t("to")}
          <input
            type="text"
            inputMode="decimal"
            value={props.state.fields.max}
            aria-invalid={props.state.error?.field === "max" || undefined}
            aria-describedby={
              props.state.error?.field === "max" ? `${id}-error` : undefined
            }
            onChange={(event) => props.onField("max", event.target.value)}
          />
        </label>
        {!props.state.automatic && (
          <label>
            {I18n.t("tickStep")}
            <input
              type="text"
              inputMode="decimal"
              value={props.state.fields.step}
              aria-invalid={props.state.error?.field === "step" || undefined}
              aria-describedby={
                props.state.error?.field === "step" ? `${id}-error` : undefined
              }
              onChange={(event) => props.onField("step", event.target.value)}
            />
          </label>
        )}
      </div>
      <div className={styles.stepRow}>
        <div
          role="radiogroup"
          aria-label={I18n.t("stepMode")}
          className={styles.mode}
        >
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              aria-label={I18n.t("automaticStep")}
              checked={props.state.automatic}
              onChange={() => props.onAutomatic(true)}
            />
            <span>{I18n.t("auto")}</span>
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              aria-label={I18n.t("manualStep")}
              checked={!props.state.automatic}
              onChange={() => props.onAutomatic(false)}
            />
            <span>{I18n.t("manual")}</span>
          </label>
        </div>
        <output aria-label={I18n.t("currentStep")}>
          {I18n.t("step", { p0: props.state.resolved?.step ?? "—" })}
        </output>
      </div>
      <div className={styles.toggles}>
        <label>
          <input
            type="checkbox"
            checked={props.state.config.numbers}
            onChange={(event) => props.onNumbers(event.target.checked)}
          />
          {I18n.t("numbers")}
        </label>
        {props.state.config.kind === "axes" && (
          <label>
            <input
              type="checkbox"
              checked={props.state.config.grid}
              onChange={(event) => props.onGrid(event.target.checked)}
            />
            {I18n.t("grid331")}
          </label>
        )}
      </div>
      {props.state.error && (
        <div className={styles.error} id={`${id}-error`} role="alert">
          <span>{I18n.text(props.state.error.message)}</span>
          {props.state.error.field === "step" &&
            props.state.recommendation !== null && (
              <Button onClick={props.onRecommendation}>
                {I18n.t("applyStep", { p0: props.state.recommendation })}
              </Button>
            )}
        </div>
      )}
    </fieldset>
  );
};
