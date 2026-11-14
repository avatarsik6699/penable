// JS cache ownership check with explicit Node GC; this does not measure browser GPU memory.
import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

if (!global.gc) throw new Error("Run with node --expose-gc");

const out = resolve(".artifacts/performance/lifecycle");

await mkdir(out, { recursive: true });

await build({
  configFile: false,
  logLevel: "silent",
  build: {
    target: "esnext",
    outDir: out,
    emptyOutDir: false,
    lib: {
      entry: resolve("src/entities/board/index.ts"),
      formats: ["es"],
      fileName: () => "cache.mjs",
    },
  },
});

const { BoardSourceGeometry, BoardPressure } = await import(
  pathToFileURL(resolve(out, "cache.mjs")).href
);

const { sourceGeometry } = BoardSourceGeometry;
const references = [];

function populate() {
  for (let j = 0; j < 200; j++) {
    const ink = {
      id: j + 1,
      width: 3,
      color: "#182230",
      points: [],
      stabilization: { strength: 65, captureZoom: 1 },
      ...(j % 3
        ? {
            style: {
              instrument: j % 3 === 1 ? "pressure" : "highlighter",
              opacity: j % 3 === 1 ? 1 : 0.3,
              pressureStrength: 65,
            },
          }
        : {}),
    };

    references.push(new WeakRef(ink), new WeakRef(ink.points));

    for (let i = 0; i < 1000; i++) {
      ink.points.push({
        x: i,
        y: Math.sin(i) * 20,
        time: i * 4,
        pressure: 0.5,
      });

      if (i % 50 === 0) {
        sourceGeometry(ink, true);

        if (ink.style?.instrument === "pressure")
          BoardPressure.ribbonGeometry(BoardPressure.outline(ink, true));
      }
    }

    if (j % 2 === 0) sourceGeometry(ink); // half committed, half cancelled

    if (ink.style?.instrument === "pressure") {
      const outline = BoardPressure.outline(ink, j % 2 !== 0);
      const geometry = BoardPressure.ribbonGeometry(outline);

      if (j % 2 === 0) BoardPressure.segments(ink);

      references.push(new WeakRef(outline));

      if (geometry) references.push(new WeakRef(geometry));
    }
  }
}

populate();

for (let i = 0; i < 5; i++) {
  await new Promise((resolve) => setImmediate(resolve));
  global.gc();
}

const retained = references.filter((reference) => reference.deref()).length;

const result = {
  strokes: 200,
  pointsPerStroke: 1000,
  weakReferences: references.length,
  retained,
  scope:
    "Node JS legacy/styled/pressure live/completed geometry and ribbon cache ownership; not browser/GPU memory",
};

await writeFile(resolve(out, "result.json"), JSON.stringify(result, null, 2));

console.log(result);

if (retained) throw new Error("Unowned stroke/point arrays retained by cache");
