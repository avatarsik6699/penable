import type React from "react";
import type { PenSettingsTypes } from "./pen-settings.types";
import styles from "./pen-settings.module.css";
import { Button } from "~/shared/ui/button";
import { EditorIcon } from "~/shared/ui/editor-icon";
import { RangeInput } from "~/shared/ui/range-input";

export const PenSettings: React.FC<PenSettingsTypes.Props> = (props) => (
  <div
    ref={(node) => {
      props.bindRoot(node);
    }}
    id="pen-panel"
    className={styles.panel}
    role="dialog"
    aria-label="Параметры пера"
  >
    <div className={styles.heading}>
      <h2>Перо</h2>
      <Button onClick={props.onClose} aria-label="Закрыть параметры пера">
        <EditorIcon name="close" />
      </Button>
    </div>
    <div className={styles.sample} aria-hidden="true">
      <svg viewBox="0 0 252 50">
        <path
          style={{ strokeWidth: props.width }}
          d="M10 36C32 36 35 10 54 14S77 44 95 31 119 8 132 22 146 44 164 26 186 11 199 24 220 36 242 17"
        />
      </svg>
    </div>
    <div className={styles.caption}>
      <label htmlFor="pen-stabilization">Стабилизация</label>
      <output htmlFor="pen-stabilization">
        {props.stabilization.toFixed(0)}
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
      aria-describedby="stabilization-help"
      aria-valuetext={`${props.stabilization.toFixed(0)} процентов`}
      onChange={(event) =>
        props.onStabilizationChange(Number(event.target.value))
      }
    />
    <div className={styles.endpoints} aria-hidden="true">
      <span>Естественнее</span>
      <span>Плавнее</span>
    </div>
    <p id="stabilization-help">
      Сглаживает движения пера.
      <br />
      Применяется к следующему штриху.
    </p>
  </div>
);
