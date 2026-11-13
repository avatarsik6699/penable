import type React from "react";
import type { BackgroundControlTypes } from "./background-control.types";
import styles from "./background-control.module.css";

import type { BackgroundMode } from "~/entities/board";

export const BackgroundControl: React.FC<BackgroundControlTypes.Props> = (
  props,
) => (
  <div className={styles["background-control"]}>
    <label htmlFor="board-background">Фон</label>
    <select
      id="board-background"
      value={props.background}
      disabled={props.readOnly}
      onChange={(event) =>
        props.onBackgroundChange(event.target.value as BackgroundMode)
      }
    >
      <option value="blank">Без фона</option>
      <option value="dots">Точки</option>
      <option value="grid">Клетка</option>
    </select>
  </div>
);
