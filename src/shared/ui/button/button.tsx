import type React from "react";
import type { ButtonTypes } from "./button.types";
import styles from "./button.module.css";

// A single native control preserves keyboard, disabled and React 19 ref behavior.
export const Button: React.FC<ButtonTypes.Props> = ({
  transientDisabled = false,
  ...nativeProps
}) => (
  <button
    {...nativeProps}
    type={nativeProps.type ?? "button"}
    className={
      [
        nativeProps.className,
        nativeProps.disabled
          ? styles.unavailable
          : transientDisabled
            ? styles.transient
            : "",
      ]
        .filter(Boolean)
        .join(" ") || undefined
    }
    disabled={nativeProps.disabled || transientDisabled}
  />
);
