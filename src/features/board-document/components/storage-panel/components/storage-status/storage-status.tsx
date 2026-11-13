import type React from "react";
import type { StorageStatusTypes } from "./storage-status.types";
import styles from "./storage-status.module.css";
import { StorageStatusConfig } from "./storage-status.config";

export const StorageStatus: React.FC<StorageStatusTypes.Props> = (props) => (
  <span
    className={[
      styles["storage-status"],
      props.state.phase === "error" ? styles["storage-status-error"] : "",
    ].join(" ")}
    role="status"
    aria-live="polite"
  >
    {props.state.phase === "error"
      ? StorageStatusConfig.labels.error
      : props.state.readOnly && props.state.loaded
        ? "Только просмотр"
        : StorageStatusConfig.labels[props.state.phase]}
  </span>
);
