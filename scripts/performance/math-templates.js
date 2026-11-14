// Native, benchmark-only coverage for the actual versioned mathematical engine.
import { BoardTemplates } from "@board";
import { paintStroke } from "@engine";

function config(kind) {
  return {
    kind,
    width: 320,
    height: kind === "number-line" ? 80 : 320,
    color: "#182230",
    lineWidth: 2,
    dashed: false,
    fill: null,
    min: -5,
    max: 5,
    step: 1,
    numbers: true,
    grid: false,
    labels: true,
    rays: true,
  };
}

function raster(template, generatorVersion, dpr, zoom) {
  const canvas = document.createElement("canvas");

  canvas.width = 520 * dpr;
  canvas.height = 520 * dpr;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  ctx.scale(dpr * zoom, dpr * zoom);

  const item = {
    kind: "template",
    id: 1,
    generatorVersion,
    matrix: [1, 0, 0, 1, 24, 24],
    template,
  };

  paintStroke(ctx, item);

  return { canvas, ctx, item };
}

async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function legacyRaster() {
  const results = [];

  for (const kind of ["number-line", "axes", "circle"])
    for (const dpr of [1, 2])
      for (const zoom of [0.5, 1, 2]) {
        const { canvas, ctx } = raster(config(kind), 1, dpr, zoom);
        const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        results.push({ kind, dpr, zoom, sha256: await digest(rgba) });
      }

  return results;
}

async function measure(templates) {
  const results = [];

  for (const template of templates) {
    const cold = [];
    let layout;

    for (let i = 0; i < 30; i++) {
      const start = performance.now();

      layout = BoardTemplates.layout({ ...template }, 2);
      cold.push(performance.now() - start);
    }

    const { canvas, ctx, item } = raster(template, 2, 1, 0.5);
    const work = [];

    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      ctx.clearRect(-50, -50, canvas.width * 2, canvas.height * 2);

      const start = performance.now();

      paintStroke(ctx, item);
      work.push(performance.now() - start);
    }

    const stats = (values) => {
      const sorted = values.slice().sort((a, b) => a - b);

      return {
        p95: sorted[Math.floor(sorted.length * 0.95)],
        max: sorted.at(-1),
      };
    };

    results.push({
      kind: template.kind,
      min: template.min,
      max: template.max,
      step: template.step,
      primitives: layout.primitives.length,
      bounds: layout.bounds,
      cold: stats(cold),
      replay: stats(work),
    });
  }

  return results;
}

export const mathBench = { legacyRaster, measure };
