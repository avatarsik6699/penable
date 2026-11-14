import type React from "react";
import type { PreviewSceneTypes } from "./preview-scene.types";

export const PreviewScene: React.FC<PreviewSceneTypes.Props> = (props) => (
  <>
    {props.layout.primitives.map((primitive, index) =>
      primitive.kind === "label" ? (
        <g key={index} fill={primitive.color} data-label={primitive.text}>
          <title>{primitive.text}</title>
          {primitive.glyphs.map((glyph, i) => (
            <path
              key={i}
              d={glyph.path}
              transform={`translate(${primitive.x + glyph.x} ${primitive.y + glyph.y}) scale(${glyph.scale})`}
            />
          ))}
        </g>
      ) : primitive.kind === "text" ? (
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
  </>
);
