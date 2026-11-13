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
  </div>
);
