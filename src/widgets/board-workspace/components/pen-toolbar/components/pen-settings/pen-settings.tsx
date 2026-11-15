import { I18n } from "~/shared/lib/i18n";
import type React from "react";
import { StrokeSample } from "./components/stroke-sample";
import type { PenSettingsTypes } from "./pen-settings.types";
import styles from "./pen-settings.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { RangeInput } from "~/shared/ui/range-input";
import { InkPalette } from "../ink-palette";
import { HelpHint } from "~/shared/ui/help-hint";
import { InstrumentPicker } from "./components/instrument-picker";

export const PenSettings: React.FC<PenSettingsTypes.Props> = (props) => (
  <div
    ref={(node) => props.bindRoot(node)}
    id="pen-panel"
    className={styles.panel}
    role="dialog"
    aria-label={I18n.t("penSettings")}
  >
    <div className={styles.heading}>
      <h2>{I18n.t("writingInstrument")}</h2>
      <div className={styles.actions}>
        <HelpHint
          label={I18n.t("aboutWritingSettings")}
          text={I18n.t("settingsApplyToTheNextStrokeStabilization")}
        />
        <Button onClick={props.onClose} aria-label={I18n.t("closePenSettings")}>
          <EditorIcon name="close" />
        </Button>
      </div>
    </div>
    <InstrumentPicker
      value={props.writing.instrument}
      disabled={props.readOnly}
      onChange={props.onInstrumentChange}
    />
    <div className={styles.touchSettings}>
      <label className={styles.fingerInput}>
        <input
          type="checkbox"
          checked={props.fingerInput}
          disabled={props.readOnly}
          onChange={(event) => props.onFingerInputChange(event.target.checked)}
        />
        <span>{I18n.t("drawWithFinger")}</span>
      </label>
      <HelpHint
        label={I18n.t("aboutFingerInput")}
        text={I18n.t("byDefaultOneFingerPansAndTwo")}
      />
    </div>
    <div className={styles.sample}>
      <StrokeSample writing={props.writing} />
    </div>
    <InkPalette
      color={props.writing.instruments[props.writing.instrument].color}
      disabled={props.readOnly}
      onChange={(color) => props.onInkSettingsChange({ color })}
    />
    <div className={styles.caption}>
      <label htmlFor="pen-stabilization">{I18n.t("stabilization")}</label>
      <output htmlFor="pen-stabilization">
        {I18n.text(props.stabilization.toFixed(0))}
        <span>%</span>
      </output>
    </div>
    <RangeInput
      id="pen-stabilization"
      min="0"
      max="100"
      step="1"
      value={props.stabilization}
      disabled={props.readOnly}
      onChange={(event) =>
        props.onStabilizationChange(Number(event.target.value))
      }
    />
    <div className={styles.endpoints}>
      <span>{I18n.t("moreNatural")}</span>
      <span>{I18n.t("smoother")}</span>
    </div>
    {props.writing.instrument === "pressure" && (
      <div className={styles.parameter}>
        <div className={styles.caption}>
          <label htmlFor="pressure-strength">
            {I18n.t("pressureStrength")}
          </label>
          <output htmlFor="pressure-strength">
            {props.writing.instruments.pressure.pressureStrength}%
          </output>
        </div>
        <RangeInput
          id="pressure-strength"
          min="0"
          max="100"
          step="1"
          value={props.writing.instruments.pressure.pressureStrength}
          disabled={props.readOnly}
          onChange={(event) =>
            props.onInkSettingsChange({
              pressureStrength: Number(event.target.value),
            })
          }
        />
      </div>
    )}
    {props.writing.instrument === "highlighter" && (
      <div className={styles.parameter}>
        <div className={styles.caption}>
          <label htmlFor="ink-opacity">{I18n.t("opacity")}</label>
          <output htmlFor="ink-opacity">
            {Math.round(props.writing.instruments.highlighter.opacity * 100)}%
          </output>
        </div>
        <RangeInput
          id="ink-opacity"
          min="10"
          max="70"
          step="1"
          value={Math.round(
            props.writing.instruments.highlighter.opacity * 100,
          )}
          disabled={props.readOnly}
          onChange={(event) =>
            props.onInkSettingsChange({
              opacity: Number(event.target.value) / 100,
            })
          }
        />
      </div>
    )}
  </div>
);
