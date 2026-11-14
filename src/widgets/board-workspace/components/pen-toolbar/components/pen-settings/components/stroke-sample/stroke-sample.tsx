import type React from "react";
import type { StrokeSampleTypes } from "./stroke-sample.types";
import { StrokeSampleUtils } from "./stroke-sample.utils";

export const StrokeSample: React.FC<StrokeSampleTypes.Props> = (props) => (
  <svg viewBox="0 0 252 70" aria-hidden="true">
    {props.writing.instrument === "pressure" ? (
      <path
        d={StrokeSampleUtils.path(props.writing)}
        style={{
          fill: props.writing.instruments.pressure.color,
          stroke: "none",
        }}
      />
    ) : (
      <path
        style={{
          strokeWidth: Math.min(
            44,
            props.writing.instruments[props.writing.instrument].width,
          ),
          stroke: props.writing.instruments[props.writing.instrument].color,
          opacity: props.writing.instruments[props.writing.instrument].opacity,
        }}
        d="M10 42C32 42 35 20 54 24S77 54 95 41 119 18 132 32 146 54 164 36 186 21 199 34 220 46 242 27"
      />
    )}
  </svg>
);
