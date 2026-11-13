import type React from "react";
import type { InkSettingsTypes } from "./ink-settings.types";
import styles from "./ink-settings.module.css";
import { RangeInput } from "~/shared/ui/range-input";

export const InkSettings: React.FC<InkSettingsTypes.Props> = (props) => (
  <div className={styles.width}>
    <span className={styles.preview} aria-hidden="true">
      <span style={{ width: props.width, height: props.width }} />
    </span>
    <label className={styles.hidden} htmlFor="pen-width">
      Толщина
    </label>
    <RangeInput
      id="pen-width"
      min="0.5"
      max="12"
      step="0.1"
      value={props.width}
      disabled={props.readOnly}
      aria-valuetext={`${props.width.toFixed(1)} пикселя`}
      onChange={(event) => props.onWidthChange(Number(event.target.value))}
    />
    <output htmlFor="pen-width">
      {props.width.toFixed(1)}
      <span>px</span>
    </output>
  </div>
);
