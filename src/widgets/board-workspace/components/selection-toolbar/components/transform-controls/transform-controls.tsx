import type React from "react";
import { useState } from "react";
import { Button } from "~/shared/ui/button";
import type { TransformControlsTypes } from "./transform-controls.types";
import styles from "./transform-controls.module.css";

export const TransformControls: React.FC<TransformControlsTypes.Props> = (
  props,
) => {
  const [width, setWidth] = useState("100"),
    [height, setHeight] = useState("100"),
    [angle, setAngle] = useState("0");

  const valid =
    [width, height, angle].every(
      (value) => value.trim() !== "" && Number.isFinite(Number(value)),
    ) &&
    Number(width) > 0 &&
    Number(height) > 0;

  return (
    <form
      className={styles.form}
      aria-label="Преобразование выделения"
      onSubmit={(event) => {
        event.preventDefault();

        if (valid) props.onApply(Number(width), Number(height), Number(angle));
      }}
    >
      <label>
        Ширина, %
        <input
          type="number"
          min="0.1"
          step="any"
          value={width}
          disabled={props.disabled}
          onChange={(event) => setWidth(event.target.value)}
        />
      </label>
      <label>
        Высота, %
        <input
          type="number"
          min="0.1"
          step="any"
          value={height}
          disabled={props.disabled}
          onChange={(event) => setHeight(event.target.value)}
        />
      </label>
      <label>
        Угол, °
        <input
          type="number"
          step="any"
          value={angle}
          disabled={props.disabled}
          onChange={(event) => setAngle(event.target.value)}
        />
      </label>
      <Button type="submit" disabled={props.disabled || !valid}>
        Применить преобразование
      </Button>
    </form>
  );
};
