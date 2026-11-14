import {
  BoardConstants,
  type TemplateConfig,
  type TemplateKind,
  type Position,
  type InkColor,
} from "../board.types";
import { BoardWriting } from "../writing";
import type { TemplateLayout, TemplatePrimitive } from "./templates.types";

const kinds = [
  "line",
  "arrow",
  "rectangle",
  "ellipse",
  "triangle",
  "number-line",
  "axes",
  "circle",
] as const;

const names: Record<TemplateKind, string> = {
  line: "Отрезок",
  arrow: "Стрелка",
  rectangle: "Прямоугольник",
  ellipse: "Эллипс",
  triangle: "Треугольник",
  "number-line": "Числовая прямая",
  axes: "Оси XY",
  circle: "Тригонометрическая окружность",
};

const cache = new WeakMap<TemplateConfig, TemplateLayout>();

function defaults(kind: TemplateKind = "rectangle"): TemplateConfig {
  return {
    kind,
    width: 320,
    height:
      kind === "number-line" || kind === "line" || kind === "arrow" ? 80 : 320,
    color: BoardConstants.INK,
    lineWidth: 2,
    dashed: false,
    fill: null,
    min: -5,
    max: 5,
    step: 1,
    numbers: true,
    grid: false,
    labels: true,
    rays: false,
  };
}

function validate(value: TemplateConfig): string {
  if (!kinds.some((kind) => kind === value.kind)) return "Выберите заготовку.";

  if (
    value.kind === "circle" &&
    (value.width !== value.height || value.width < 280)
  )
    return "Окружность должна быть квадратной, размер — от 280.";

  if (
    ![value.width, value.height].every(
      (n) => Number.isFinite(n) && n >= 40 && n <= 2000,
    )
  )
    return "Размер должен быть от 40 до 2000.";

  if (
    !BoardWriting.isColor(value.color) ||
    (value.fill !== null && !BoardWriting.isColor(value.fill))
  )
    return "Выберите цвет из палитры.";

  if (
    !Number.isFinite(value.lineWidth) ||
    value.lineWidth < 0.5 ||
    value.lineWidth > 12
  )
    return "Толщина должна быть от 0,5 до 12.";

  if (
    ![value.dashed, value.numbers, value.grid, value.labels, value.rays].every(
      (n) => typeof n === "boolean",
    )
  )
    return "Некорректные параметры заготовки.";

  if (
    ![value.min, value.max, value.step].every(Number.isFinite) ||
    Math.abs(value.min) > 10000 ||
    Math.abs(value.max) > 10000 ||
    value.step < 0.000001
  )
    return "Задайте конечный диапазон и положительный шаг.";

  if (value.min >= value.max || value.min > 0 || value.max < 0)
    return "Диапазон должен возрастать и включать ноль.";

  if (value.kind === "number-line" || value.kind === "axes") {
    const count = Math.floor((value.max - value.min) / value.step) + 1;
    const first = Math.ceil(value.min / value.step) * value.step;

    const labels = Array.from(
      { length: Math.min(42, Math.max(0, count)) },
      (_, i) => Number((first + i * value.step).toFixed(6)).toString(),
    );

    const horizontalSpacing = value.numbers
      ? Math.max(22, ...labels.map((label) => label.length * 8.2 + 6))
      : 8;

    if (
      count > 41 ||
      count < 2 ||
      (value.width - 56) / (count - 1) < horizontalSpacing ||
      (value.kind === "axes" &&
        (value.height - 56) / (count - 1) < (value.numbers ? 22 : 8))
    )
      return "Слишком частые деления: увеличьте шаг или размер заготовки.";
  }

  return "";
}

function layout(config: TemplateConfig): TemplateLayout {
  const known = cache.get(config);

  if (known) return known;

  const error = validate(config);

  if (error) throw new Error(error);

  const primitives: TemplatePrimitive[] = [];
  const { width: w, height: h } = config;

  const path = (
    points: Position[],
    closed = false,
    fill: InkColor | null = null,
    dashed = config.dashed,
    width = config.lineWidth,
  ) =>
    primitives.push({
      kind: "path",
      points,
      closed,
      fill,
      dashed,
      width,
      color: config.color,
    });

  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashed = config.dashed,
    width = config.lineWidth,
  ) =>
    path(
      [
        { x: x1, y: y1 },
        { x: x2, y: y2 },
      ],
      false,
      null,
      dashed,
      width,
    );

  const text = (label: string, x: number, y: number, size = 12) => {
    const width = Math.max(size, label.length * size * 0.68);

    primitives.push({
      kind: "text",
      text: label,
      x: x - width / 2,
      y: y - size / 2,
      size,
      color: config.color,
      width,
      height: size * 1.3,
    });
  };

  const arrow = (x1: number, y1: number, x2: number, y2: number) => {
    line(x1, y1, x2, y2);

    const angle = Math.atan2(y2 - y1, x2 - x1),
      size = 8;

    line(
      x2 - size * Math.cos(angle - 0.5),
      y2 - size * Math.sin(angle - 0.5),
      x2,
      y2,
      false,
    );

    line(
      x2,
      y2,
      x2 - size * Math.cos(angle + 0.5),
      y2 - size * Math.sin(angle + 0.5),
      false,
    );
  };

  const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
    primitives.push({
      kind: "ellipse",
      cx,
      cy,
      rx,
      ry,
      fill: config.fill,
      width: config.lineWidth,
      color: config.color,
      dashed: config.dashed,
    });

  if (config.kind === "line") line(8, h / 2, w - 8, h / 2);
  else if (config.kind === "arrow") arrow(8, h / 2, w - 8, h / 2);
  else if (config.kind === "rectangle")
    path(
      [
        { x: 8, y: 8 },
        { x: w - 8, y: 8 },
        { x: w - 8, y: h - 8 },
        { x: 8, y: h - 8 },
      ],
      true,
      config.fill,
    );
  else if (config.kind === "ellipse")
    ellipse(w / 2, h / 2, w / 2 - 8, h / 2 - 8);
  else if (config.kind === "triangle")
    path(
      [
        { x: w / 2, y: 8 },
        { x: w - 8, y: h - 8 },
        { x: 8, y: h - 8 },
      ],
      true,
      config.fill,
    );
  else if (config.kind === "axes" || config.kind === "number-line") {
    const margin = 28,
      span = config.max - config.min;

    const px = (n: number) =>
      margin + ((n - config.min) / span) * (w - margin * 2);

    const py = (n: number) =>
      h - margin - ((n - config.min) / span) * (h - margin * 2);

    const axisY = config.kind === "number-line" ? h / 2 : py(0);

    if (config.grid && config.kind === "axes")
      for (let i = 0; i <= 40; i++) {
        const n =
          Math.ceil(config.min / config.step) * config.step + i * config.step;

        if (n > config.max + config.step * 1e-8) break;

        line(px(n), margin, px(n), h - margin, true, 0.5);
        line(margin, py(n), w - margin, py(n), true, 0.5);
      }

    arrow(margin - 8, axisY, w - 12, axisY);
    text("x", w - 9, axisY - 14);

    if (config.kind === "axes") {
      arrow(px(0), h - margin + 8, px(0), 12);
      text("y", px(0) + 14, 12);
    }

    for (let i = 0; i <= 40; i++) {
      const n =
        Math.ceil(config.min / config.step) * config.step + i * config.step;

      if (n > config.max + config.step * 1e-8) break;

      const label = Number(n.toFixed(6)).toString();

      line(px(n), axisY - 4, px(n), axisY + 4, false);

      if (config.numbers) text(label, px(n), axisY + 16);

      if (config.kind === "axes") {
        line(px(0) - 4, py(n), px(0) + 4, py(n), false);

        if (config.numbers && Math.abs(n) > 1e-8)
          text(label, px(0) - 17, py(n));
      }
    }
  } else {
    const cx = w / 2,
      cy = h / 2,
      r = Math.min(w, h) / 2 - 44;

    ellipse(cx, cy, r, r);
    arrow(12, cy, w - 12, cy);
    arrow(cx, h - 12, cx, 12);
    text("x", w - 10, cy - 15);
    text("y", cx + 14, 12);
    text("1", cx + r, cy + 16);
    text("−1", cx - r, cy + 16);
    text("1", cx - 16, cy - r);
    text("−1", cx - 18, cy + r);

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

    for (const [fraction, label] of angles) {
      const a = fraction * Math.PI,
        ux = Math.cos(a),
        uy = -Math.sin(a);

      line(
        cx + ux * (r - 3),
        cy + uy * (r - 3),
        cx + ux * (r + 3),
        cy + uy * (r + 3),
        false,
      );

      if (config.rays) line(cx, cy, cx + ux * r, cy + uy * r, true, 0.7);

      if (config.labels)
        text(label, cx + ux * (r + 25), cy + uy * (r + 25), 11);
    }
  }

  let left = 0,
    top = 0,
    right = w,
    bottom = h;

  for (const primitive of primitives) {
    if (primitive.kind === "text") {
      left = Math.min(left, primitive.x);
      top = Math.min(top, primitive.y);
      right = Math.max(right, primitive.x + primitive.width);
      bottom = Math.max(bottom, primitive.y + primitive.height);
    }
  }

  const result = {
    primitives,
    bounds: {
      left: left - config.lineWidth / 2,
      top: top - config.lineWidth / 2,
      right: right + config.lineWidth / 2,
      bottom: bottom + config.lineWidth / 2,
    },
  };

  cache.set(config, result);

  return result;
}

export const BoardTemplates = { kinds, names, defaults, validate, layout };
