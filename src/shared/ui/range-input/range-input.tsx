import type React from "react";
import type { RangeInputTypes } from "./range-input.types";
export const RangeInput: React.FC<RangeInputTypes.Props> = (props) => (
  <input {...props} type="range" />
);
