import type React from "react";
import type { EditorIconTypes } from "./editor-icon.types";
import { EditorIconConfig } from "./editor-icon.config";
import styles from "./editor-icon.module.css";

export const EditorIcon: React.FC<EditorIconTypes.Props> = (props) => {
  const Icon = EditorIconConfig.icons[props.name];

  return (
    <Icon
      className={[styles.icon, props.className ?? ""].join(" ")}
      size={22}
      strokeWidth={2}
      aria-hidden="true"
      focusable="false"
    />
  );
};
