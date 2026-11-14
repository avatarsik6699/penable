// A native raster oracle for contour chunking, built only into ignored benchmarks.
import { BoardPressure } from "@board";
import { BoardPaint } from "@workspace";
import { PressureRibbonReference } from "@pressure-reference";

function traceReference(context, stroke) {
  context.save();

  try {
    if (stroke.matrix) context.transform(...stroke.matrix);

    if (stroke.clip) {
      context.beginPath();

      for (const polygon of stroke.clip)
        for (const ring of polygon) {
          ring.forEach(([x, y], index) =>
            index ? context.lineTo(x, y) : context.moveTo(x, y),
          );

          context.closePath();
        }

      context.clip("nonzero");
    }

    const ribbon = PressureRibbonReference.ribbon(
      BoardPressure.outline(stroke, true),
    );

    if (!ribbon) return;

    context.fillStyle = stroke.color;

    const path = new Path2D();

    if (ribbon.left.length === 1) {
      path.arc(
        ribbon.first.x,
        ribbon.first.y,
        ribbon.first.radius,
        0,
        Math.PI * 2,
      );
    } else {
      path.moveTo(ribbon.left[0].x, ribbon.left[0].y);

      for (const point of ribbon.left.slice(1)) path.lineTo(point.x, point.y);

      path.arc(
        ribbon.last.x,
        ribbon.last.y,
        ribbon.last.radius,
        ribbon.endAngle,
        ribbon.endAngle - Math.PI,
        true,
      );

      for (let i = ribbon.right.length - 2; i >= 0; i--)
        path.lineTo(ribbon.right[i].x, ribbon.right[i].y);

      path.arc(
        ribbon.first.x,
        ribbon.first.y,
        ribbon.first.radius,
        ribbon.startAngle - Math.PI,
        ribbon.startAngle - Math.PI * 2,
        true,
      );

      path.closePath();
    }

    context.fill(path, "nonzero");
  } finally {
    context.restore();
  }
}

function sample(fixture, index) {
  const phase = index % 256;
  const triangle = phase < 128 ? phase : 256 - phase;

  const point =
    fixture === "reversal"
      ? { x: 40 + triangle * 2, y: 100 + Math.floor(index / 256) * 6 }
      : fixture === "loops"
        ? {
            x: 180 + 80 * Math.cos(index * 0.025),
            y: 120 + 60 * Math.sin(index * 0.025),
          }
        : fixture === "stationary"
          ? { x: index < 300 ? 100 : 100 + (index - 300) * 0.1, y: 128 }
          : { x: 40 + index * 0.2, y: 120 + 55 * Math.sin(index * 0.03) };

  return {
    ...point,
    pressure: 0.03 + (0.94 * (Math.sin(index * 0.12) + 1)) / 2,
    time: index + 1,
  };
}

function diagnosticImage(contexts, actual, reference, dpr) {
  const width = 512 * dpr,
    height = 256 * dpr;

  const difference = Object.assign(document.createElement("canvas"), {
    width,
    height,
  });

  const diffContext = difference.getContext("2d");
  const data = diffContext.createImageData(width, height);

  let left = width,
    right = 0,
    top = height,
    bottom = 0,
    edgeOnly = true;

  for (let pixel = 0; pixel < actual.length; pixel += 4) {
    const delta = Math.abs(actual[pixel + 3] - reference[pixel + 3]);

    data.data[pixel] = 255;

    data.data[pixel + 1] = data.data[pixel + 2] =
      255 - Math.min(255, delta * 16);

    data.data[pixel + 3] = 255;

    if (!delta) continue;

    const x = (pixel / 4) % width,
      y = Math.floor(pixel / 4 / width);

    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);

    if (
      ![actual[pixel + 3], reference[pixel + 3]].some(
        (alpha) => alpha > 0 && alpha < 255,
      )
    )
      edgeOnly = false;
  }

  diffContext.putImageData(data, 0, 0);

  const image = Object.assign(document.createElement("canvas"), {
    width: 1024,
    height: 600,
  });

  const painter = image.getContext("2d");

  painter.fillStyle = "white";
  painter.fillRect(0, 0, image.width, image.height);
  painter.fillStyle = "black";
  painter.font = "14px sans-serif";
  painter.fillText("Chunked contour on white", 8, 18);
  painter.fillText("Full-contour reference on white", 520, 18);
  painter.drawImage(contexts[0].canvas, 0, 28, 512, 256);
  painter.drawImage(contexts[1].canvas, 512, 28, 512, 256);
  painter.fillText("Alpha difference, intensity x16", 8, 310);
  painter.drawImage(difference, 0, 324, 512, 256);
  painter.fillText("Changed area enlarged (nearest-neighbor)", 520, 310);
  painter.imageSmoothingEnabled = false;

  if (left <= right) {
    const x = Math.max(0, left - 3),
      y = Math.max(0, top - 3);

    const w = Math.min(width - x, right - left + 7),
      h = Math.min(height - y, bottom - top + 7);

    painter.drawImage(difference, x, y, w, h, 512, 324, 512, 256);
  }

  return {
    image: image.toDataURL(),
    edgeOnly,
    changedBounds: { left, top, right, bottom },
  };
}

export function comparePressureReference() {
  const diffs = [];
  const diagnostics = [];
  let comparisons = 0;

  for (const fixture of ["line", "reversal", "loops", "stationary"])
    for (const dpr of [1, 2])
      for (const zoom of [0.25, 1, 4, 8])
        for (const transformed of [false, true]) {
          const contexts = Array.from({ length: 2 }, () => {
            const canvas = Object.assign(document.createElement("canvas"), {
              width: 512 * dpr,
              height: 256 * dpr,
            });

            return canvas.getContext("2d", { willReadFrequently: true });
          });

          const stroke = {
            id: 1,
            color: "#175cd3",
            width: 8,
            style: {
              instrument: "pressure",
              opacity: 1,
              pressureStrength: 100,
            },
            stabilization: { strength: 65, captureZoom: zoom },
            points: [],
            ...(transformed
              ? {
                  matrix: [1.1, 0.1, -0.05, 0.9, 10, 8],
                  clip: [
                    [
                      [
                        [30, 35],
                        [370, 35],
                        [370, 220],
                        [30, 220],
                        [30, 35],
                      ],
                    ],
                  ],
                }
              : {}),
          };

          for (let index = 0; index < 1600; index++) {
            stroke.points.push(sample(fixture, index));

            // Exercise the real incremental owner before every sealed boundary.
            if (index % 31 === 0) BoardPressure.outline(stroke, true);

            if (![63, 511, 1599].includes(index)) continue;

            for (const context of contexts) {
              context.resetTransform();
              context.clearRect(0, 0, 512 * dpr, 256 * dpr);

              context.setTransform(
                dpr * zoom,
                0,
                0,
                dpr * zoom,
                dpr * (120 - 120 * zoom),
                dpr * (120 - 120 * zoom),
              );
            }

            BoardPaint.paintStroke(contexts[0], stroke, true);
            traceReference(contexts[1], stroke);

            const a = contexts[0].getImageData(0, 0, 512 * dpr, 256 * dpr).data;
            const b = contexts[1].getImageData(0, 0, 512 * dpr, 256 * dpr).data;
            let different = 0;

            let maxDelta = 0,
              maxAlphaDelta = 0;

            for (let i = 0; i < a.length; i++)
              if (a[i] !== b[i]) {
                different++;
                maxDelta = Math.max(maxDelta, Math.abs(a[i] - b[i]));

                if (i % 4 === 3)
                  maxAlphaDelta = Math.max(
                    maxAlphaDelta,
                    Math.abs(a[i] - b[i]),
                  );
              }

            comparisons++;

            if (different) {
              const detail = {
                fixture,
                dpr,
                zoom,
                transformed,
                prefix: index + 1,
                different,
                maxDelta,
                maxAlphaDelta,
              };

              diffs.push(detail);

              if (
                diagnostics.length < 3 ||
                maxAlphaDelta > diagnostics.at(-1).maxAlphaDelta
              ) {
                diagnostics.push({
                  ...detail,
                  ...diagnosticImage(contexts, a, b, dpr),
                });

                diagnostics.sort((a, b) => b.maxAlphaDelta - a.maxAlphaDelta);
                diagnostics.length = Math.min(3, diagnostics.length);
              }
            }
          }
        }

  return { comparisons, diffs, diagnostics };
}
