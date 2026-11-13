import { RangeInput } from "~/shared/ui/range-input";
import type React from "react";
import type { BackgroundControlTypes } from "./background-control.types";
import styles from "./background-control.module.css";
import type { BackgroundMode } from "~/entities/board";

export const BackgroundControl: React.FC<BackgroundControlTypes.Props> = (
  props,
) => (
  <div className={styles.root}>
    <h3>Фон доски</h3>
    <div className={styles.options} role="group" aria-label="Фон доски">
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
            {mode === "blank"
              ? "Без фона"
              : mode === "dots"
                ? "Точки"
                : "Клетка"}
          </span>
        </button>
      ))}
    </div>
    {props.background !== "blank" && (
      <div className={styles.settings}>
        <label htmlFor="background-contrast">
          Контраст фона <output>{props.settings.contrast}%</output>
        </label>
        <RangeInput
          id="background-contrast"
          aria-label="Контраст фона"
          aria-valuetext={`${props.settings.contrast}%`}
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
          Шаг фона <output>{props.settings.spacing}</output>
        </label>
        <RangeInput
          id="background-spacing"
          aria-label="Шаг фона"
          aria-valuetext={`${props.settings.spacing} единиц доски`}
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
        <p>
          При отдалении фон становится реже. Настройки сохраняются с доской.
        </p>
      </div>
    )}
  </div>
);
