import type { MathBuilder } from "./math-layout.types";

const angles = [
  [0, "0"],
  [1 / 6, "π/6"],
  [1 / 4, "π/4"],
  [1 / 3, "π/3"],
  [1 / 2, "π/2"],
  [2 / 3, "2π/3"],
  [3 / 4, "3π/4"],
  [5 / 6, "5π/6"],
  [1, "π"],
  [7 / 6, "7π/6"],
  [5 / 4, "5π/4"],
  [4 / 3, "4π/3"],
  [3 / 2, "3π/2"],
  [5 / 3, "5π/3"],
  [7 / 4, "7π/4"],
  [11 / 6, "11π/6"],
] as const;

function build(b: MathBuilder) {
  const { config, primitives, line, arrow, label } = b;

  const c = 240,
    r = 154;

  primitives.push({
    kind: "ellipse",
    cx: c,
    cy: c,
    rx: r,
    ry: r,
    width: config.lineWidth,
    color: config.color,
    fill: null,
    dashed: false,
  });

  arrow(18, c, 462, c);
  arrow(c, 462, c, 18);
  label("x", 460, c - 18);
  label("y", c + 18, 20);

  if (config.numbers) {
    label("1", c + r - 20, c + 12, 1, -1);
    label("−1", c - r + 20, c + 12, -1, -1);
    label("1", c - 12, c - r + 20, 1, -1);
    label("−1", c - 12, c + r - 20, 1, 1);
  }

  for (const [fraction, text] of angles) {
    const angle = fraction * Math.PI,
      x = Math.cos(angle),
      y = -Math.sin(angle);

    line(c + x * (r - 4), c + y * (r - 4), c + x * (r + 4), c + y * (r + 4));

    if (config.rays) line(c, c, c + x * r, c + y * r, true, 0.7);

    if (!config.labels) continue;

    // Cardinal labels clear both axis arms; others sit beyond the circle and tick.
    if (fraction === 0) label(text, c + r + 18, c - 12, -1, 1);
    else if (fraction === 1) label(text, c - r - 18, c - 12, 1, 1);
    else if (fraction === 0.5) label(text, c + 12, c - r - 18, -1, 1);
    else if (fraction === 1.5) label(text, c + 12, c + r + 18, -1, -1);
    else
      label(
        text,
        c + x * (r + 24),
        c + y * (r + 24),
        x > 0 ? -1 : 1,
        y > 0 ? -1 : 1,
      );
  }

  return { x: c, y: c };
}

export const MathCircle = { build };
