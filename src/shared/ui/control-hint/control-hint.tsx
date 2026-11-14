import type React from "react";
import type { ControlHintTypes } from "./control-hint.types";
import styles from "./control-hint.module.css";

export const ControlHint: React.FC<ControlHintTypes.Props> = (props) => (
  <span className={styles.anchor} data-align={props.align}>
    {props.children}
    <span className={styles.hint} role="tooltip">
      {props.label}
    </span>
  </span>
);
