import type React from "react";
import type { InkSettingsTypes } from "./ink-settings.types";
import styles from "./ink-settings.module.css";
import { RangeInput } from "~/shared/ui/range-input";

export const InkSettings: React.FC<InkSettingsTypes.Props> = (props) => (
  <>
    <div className={styles["width-control"]}>
      <label htmlFor="pen-width">Толщина</label>
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
        {props.width.toFixed(1)} <span>px</span>
      </output>
      <span className={styles["pen-preview"]} aria-hidden="true">
        <span style={{ width: props.width, height: props.width }} />
      </span>
    </div>
    <div className={styles["stabilization-control"]}>
      <div>
        <label htmlFor="pen-stabilization">Стабилизация</label>
        <span id="stabilization-help" className={styles["setting-help"]}>
          Со следующего штриха
        </span>
      </div>
      <RangeInput
        id="pen-stabilization"

        min="0"
        max="100"
        step="1"
        value={props.stabilization}
        disabled={props.readOnly}
        aria-describedby="stabilization-help"
        aria-valuetext={`${props.stabilization.toFixed(0)} процентов`}
        onChange={(event) =>
          props.onStabilizationChange(Number(event.target.value))
        }
      />
      <output htmlFor="pen-stabilization">
        {props.stabilization.toFixed(0)} <span>%</span>
      </output>
    </div>
  </>
);
