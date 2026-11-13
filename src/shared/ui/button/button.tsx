import type React from "react";
import type { ButtonTypes } from "./button.types";
// A single native control preserves keyboard, disabled and React 19 ref behavior.
export const Button: React.FC<ButtonTypes.Props> = (props) => (
  <button {...props} type={props.type ?? "button"} />
);
