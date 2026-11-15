// Benchmark only: actual eraser, renderer and history on owned synthetic scenes.
import { EraserInput, StrokeHistory } from "@engine";

function fixture(id, points, kind) {
  const x = 40 + (id % 40) * 120,
    y = 50 + Math.floor(id / 40) * 40;

  const transformed =
    kind === "affine" || kind === "affine-pen" || kind === "clipped";

  const ink = {
    id: id + 1,
    color: "#182230",
    width: 3,
    stabilization: { strength: 65, captureZoom: 1 },
    points: Array.from({ length: points }, (_, i) => ({
      x: i * 2 + (transformed ? 0 : x),
      y: Math.sin(i * 0.7) * 8 + (transformed ? 0 : y),
      pressure: 0.2 + ((i % 7) / 7) * 0.8,
      time: i * 4 + 1,
    })),
  };

  if (kind !== "plain" && kind !== "affine-pen")
    ink.style = { instrument: "pressure", opacity: 1, pressureStrength: 65 };

  if (transformed) ink.matrix = [1, 0.15, -0.08, 1, x, y];

  if (kind === "clipped") {
    ink.source = `eraser-bench-${id}`;

    ink.clip = [
      [
        [
          [-2, -12],
          [points * 2, -12],
          [points * 2, 12],
          [-2, 12],
          [-2, -12],
        ],
      ],
    ];
  }

  return ink;
}

function create({ setup, observe, nextFrame, stats, pointer }) {
  return async function eraserScene({
    count = 1200,
    points = 40,
    kind = "pressure",
    mode = "miss",
    frames = 12,
    coalesced = 8,
  } = {}) {
    const { scene, renderer, flush } = setup(
      Array.from({ length: count }, (_, i) => fixture(i, points, kind)),
    );

    const history = new StrokeHistory(scene.strokes, scene.strokes.length);
    let previewChanges = 0;

    const input = new EraserInput({
      scene,
      bounds: () => ({ left: 0, top: 0 }),
      viewport: () => ({ zoom: 1, x: 0, y: 0 }),

      onPreviewChange: () => {
        previewChanges++;
        renderer.setEraserPreview(input.preview);
      },

      onCommit: (erased) => history.erase(erased),
    });

    flush();

    const work = [],
      hitWork = [],
      paintWork = [];

    const sample = (i) =>
      pointer({
        x: mode === "miss" ? -100 + i / 20 : 40 + i * 5,
        y: mode === "miss" ? -100 : 50,
        pressure: 0.5,
        time: i + 1,
      });

    const result = await observe(async () => {
      let started = performance.now();

      input.down(sample(0));
      flush();

      const downMs = performance.now() - started;

      for (let frame = 0; frame < frames; frame++) {
        await nextFrame();

        const samples = Array.from({ length: coalesced }, (_, i) =>
          sample(1 + frame * coalesced + i),
        );

        started = performance.now();
        input.move({ ...samples.at(-1), getCoalescedEvents: () => samples });

        const hitMs = performance.now() - started;

        flush();
        hitWork.push(hitMs);
        paintWork.push(performance.now() - started - hitMs);
        work.push(performance.now() - started);
      }

      const hits = input.preview.size;

      started = performance.now();
      input.up({ ...sample(frames * coalesced), buttons: 0, pressure: 0 });
      flush();

      const finishMs = performance.now() - started;
      const remaining = scene.strokes.length;

      if (hits) {
        history.undo();
        renderer.sceneChanged();
        flush();
      }

      const restored = scene.strokes.length === count;

      if (hits) {
        history.redo();
        renderer.sceneChanged();
        flush();
      }

      return {
        fixture: "eraser-full-pipeline",
        count,
        points,
        kind,
        mode,
        frames,
        coalesced,
        downMs,
        work: stats(work),
        hitWork: stats(hitWork),
        paintWork: stats(paintWork),
        finishMs,
        hits,
        remaining,
        restored,
        redone: scene.strokes.length === remaining,
        previewChanges,
      };
    });

    renderer.dispose();

    return result;
  };
}

export const EraserBenchmark = { create };
