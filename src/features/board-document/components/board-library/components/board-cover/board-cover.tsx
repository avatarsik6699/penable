import type React from "react";
import { BoardCoverConfig } from "./board-cover.config";
import type { BoardCoverTypes } from "./board-cover.types";
import styles from "./board-cover.module.css";

export const BoardCover: React.FC<BoardCoverTypes.Props> = (props) => {
  const Icon = BoardCoverConfig.icons[props.appearance.icon];

  return (
    <span
      className={`${styles.cover} ${styles[props.appearance.color]}`}
      aria-hidden="true"
    >
      <Icon size={22} strokeWidth={2} focusable="false" />
    </span>
  );
};
