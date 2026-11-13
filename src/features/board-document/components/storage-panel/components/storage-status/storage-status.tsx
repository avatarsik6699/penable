import type React from "react";
import type { StorageStatusTypes } from "./storage-status.types";
import styles from "./storage-status.module.css";
import { StorageStatusPresentation } from "./storage-status.utils";

export const StorageStatus: React.FC<StorageStatusTypes.Props> = (props) => (
  <span
    className={[
      styles["storage-status"],
      props.state.phase === "error" ? styles["storage-status-error"] : "",
    ].join(" ")}
    role="status"
    aria-live="polite"
  >
    {StorageStatusPresentation.label(props.state)}
  </span>
);
