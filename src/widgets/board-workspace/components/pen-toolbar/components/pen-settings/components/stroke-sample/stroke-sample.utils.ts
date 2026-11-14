import {
  BoardPressure,
  type WritingSettings,
  type Stroke,
} from "~/entities/board";

function path(writing: WritingSettings): string {
  const settings = writing.instruments[writing.instrument];

  const stroke: Stroke = {
    id: 1,
    color: settings.color,
    width: settings.width,
    style: {
      instrument: "pressure",
      opacity: 1,
      pressureStrength: settings.pressureStrength,
    },
    stabilization: { strength: settings.stabilization, captureZoom: 1 },
    points: Array.from({ length: 61 }, (_, i) => ({
      x: 10 + i * 3.8,
      y: 25 + 12 * Math.sin((i / 60) * Math.PI * 4),
      pressure: 0.1 + 0.9 * Math.sin((i / 60) * Math.PI) ** 2,
      time: i * 8,
    })),
  };

  const ribbon = BoardPressure.ribbon(BoardPressure.outline(stroke));

  if (!ribbon) return "";

  return (
    ribbon.left
      .map((point, i) => `${i ? "L" : "M"}${point.x} ${point.y}`)
      .join("") +
    `A${ribbon.last.radius} ${ribbon.last.radius} 0 0 0 ${ribbon.right.at(-1)!.x} ${ribbon.right.at(-1)!.y}` +
    [...ribbon.right]
      .reverse()
      .slice(1)
      .map((point) => `L${point.x} ${point.y}`)
      .join("") +
    `A${ribbon.first.radius} ${ribbon.first.radius} 0 0 0 ${ribbon.left[0]!.x} ${ribbon.left[0]!.y}Z`
  );
}

export const StrokeSampleUtils = { path };
