import type React from "react";
import { BoardTemplates } from "~/entities/board";
import type { TemplatePreviewTypes } from "./template-preview.types";

export const TemplatePreview: React.FC<TemplatePreviewTypes.Props> = (
  props,
) => (
  <svg
    viewBox={`-8 -8 ${props.config.width + 16} ${props.config.height + 16}`}
    aria-label="Предварительный вид заготовки"
    role="img"
  >
    {BoardTemplates.layout(props.config).primitives.map((primitive, index) =>
      primitive.kind === "text" ? (
        <text
          key={index}
          x={primitive.x}
          y={primitive.y}
          fontSize={primitive.size}
          fill={primitive.color}
          fontFamily="Arial, sans-serif"
          dominantBaseline="text-before-edge"
          textLength={primitive.width}
          lengthAdjust="spacingAndGlyphs"
        >
          {primitive.text}
        </text>
      ) : primitive.kind === "ellipse" ? (
        <ellipse
          key={index}
          cx={primitive.cx}
          cy={primitive.cy}
          rx={primitive.rx}
          ry={primitive.ry}
          fill={primitive.fill ?? "none"}
          stroke={primitive.color}
          strokeWidth={primitive.width}
          strokeDasharray={
            primitive.dashed
              ? `${primitive.width * 3} ${primitive.width * 2}`
              : undefined
          }
        />
      ) : (
        <path
          key={index}
          d={
            primitive.points
              .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
              .join(" ") + (primitive.closed ? " Z" : "")
          }
          fill={primitive.fill ?? "none"}
          stroke={primitive.color}
          strokeWidth={primitive.width}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={
            primitive.dashed
              ? `${primitive.width * 3} ${primitive.width * 2}`
              : undefined
          }
        />
      ),
    )}
  </svg>
);
