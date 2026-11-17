// Benchmark-only native raster/renderer evidence. Never imported by production.
import { paintStroke } from "@engine";

const colors = [
  "#182230",
  "#667085",
  "#175cd3",
  "#0ba5ec",
  "#0e9384",
  "#2e7d32",
  "#f4c430",
  "#e87518",
  "#d92d20",
  "#7f56d9",
];

async function digest(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function lightRaster() {
  const hashes = [];

  for (const instrument of ["legacy", "pen", "pressure", "highlighter"])
    for (const dpr of [1, 2]) {
      const canvas = document.createElement("canvas");

      canvas.width = 400 * dpr;
      canvas.height = 300 * dpr;

      const ctx = canvas.getContext("2d", { willReadFrequently: true });

      ctx.scale(dpr, dpr);

      for (const [index, color] of colors.entries()) {
        const stroke = {
          id: index + 1,
          color,
          width: instrument === "highlighter" ? 18 : 3,
          points: Array.from({ length: 45 }, (_, i) => ({
            x: 10 + i * 7.5,
            y: 12 + index * 28 + Math.sin(i * 0.5) * 6,
            pressure: 0.1 + (i % 15) / 18,
            time: 1 + i * 4,
          })),
          stabilization: { strength: 65, captureZoom: 1 },
          ...(instrument === "legacy"
            ? {}
            : {
                style: {
                  instrument,
                  opacity: instrument === "highlighter" ? 0.3 : 1,
                  pressureStrength: 65,
                },
              }),
        };

        paintStroke(ctx, stroke);
      }

      hashes.push({
        instrument,
        dpr,
        sha256: await digest(
          ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        ),
      });
    }

  return hashes;
}

function create({ setup, note, observe, nextFrame, stats }) {
  return {
    lightRaster,

    async repaint(count = 10000, points = 50) {
      const strokes = Array.from({ length: count }, (_, index) =>
        note(index + 1, points),
      );

      const { scene, renderer, flush } = setup(strokes);

      if (typeof renderer.setTheme !== "function") {
        renderer.dispose();

        return { supported: false };
      }

      flush();

      const canvas = document.getElementById("completed");
      const readback = document.createElement("canvas");

      readback.width = canvas.width;
      readback.height = canvas.height;

      const context = readback.getContext("2d", { willReadFrequently: true });

      const capture = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(canvas, 0, 0);

        return context.getImageData(0, 0, canvas.width, canvas.height).data;
      };

      const original = await digest(capture());
      const stroke = scene.strokes[0];
      const raw = stroke.points;
      const work = [];

      const result = await observe(async () => {
        for (let pass = 0; pass < 12; pass++) {
          await nextFrame();

          const start = performance.now();

          renderer.setTheme(pass % 2 === 0 ? "dark" : "light");
          flush();
          work.push(performance.now() - start);
        }

        return { fixture: "theme-repaint", count, points, work: stats(work) };
      });

      const restored = original === (await digest(capture()));

      const retained =
        scene.strokes === strokes &&
        scene.strokes[0] === stroke &&
        stroke.points === raw &&
        stroke.color === "#182230";

      renderer.dispose();

      return { ...result, restored, retained };
    },
  };
}

export const ThemeBenchmark = { create };
