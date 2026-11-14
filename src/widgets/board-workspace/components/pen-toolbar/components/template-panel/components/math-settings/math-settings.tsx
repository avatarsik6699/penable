import type React from "react";
import { useId } from "react";
import { Button } from "~/shared/ui/button";
import type { MathSettingsTypes } from "./math-settings.types";
import styles from "./math-settings.module.css";

export const MathSettings: React.FC<MathSettingsTypes.Props> = (props) => {
  const id = useId();

  return (
    <fieldset className={styles.settings} disabled={props.disabled}>
      <legend>Диапазон и деления</legend>
      <div className={styles.fields}>
        <label>
          От
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
          До
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
            Шаг делений
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
        <div role="radiogroup" aria-label="Выбор шага" className={styles.mode}>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              aria-label="Автоматический шаг"
              checked={props.state.automatic}
              onChange={() => props.onAutomatic(true)}
            />
            <span>Авто</span>
          </label>
          <label>
            <input
              type="radio"
              name={`${id}-mode`}
              aria-label="Шаг вручную"
              checked={!props.state.automatic}
              onChange={() => props.onAutomatic(false)}
            />
            <span>Вручную</span>
          </label>
        </div>
        <output aria-label="Текущий шаг">
          Шаг: {props.state.resolved?.step ?? "—"}
        </output>
      </div>
      <div className={styles.toggles}>
        <label>
          <input
            type="checkbox"
            checked={props.state.config.numbers}
            onChange={(event) => props.onNumbers(event.target.checked)}
          />
          Числа
        </label>
        {props.state.config.kind === "axes" && (
          <label>
            <input
              type="checkbox"
              checked={props.state.config.grid}
              onChange={(event) => props.onGrid(event.target.checked)}
            />
            Сетка
          </label>
        )}
      </div>
      {props.state.error && (
        <div className={styles.error} id={`${id}-error`} role="alert">
          <span>{props.state.error.message}</span>
          {props.state.error.field === "step" &&
            props.state.recommendation !== null && (
              <Button onClick={props.onRecommendation}>
                Применить шаг {props.state.recommendation}
              </Button>
            )}
        </div>
      )}
    </fieldset>
  );
};
