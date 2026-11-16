// Separate benchmark bundle. Calls real codec, Worker transport and IDB adapters.
// Explicit storage claim is restricted to an empty, owned benchmark origin.
import {
  DocumentCodec,
  DocumentJobs,
  DocumentRepositoryAdapter,
  DocumentSession,
  DocumentSnapshots,
  DocumentWriterLease,
} from "@document";
import * as Document from "@document";
import { BoardSelection } from "@board";
import { EditorLifecycleBenchmark } from "./editor-lifecycle.js";
import { WorkerProbe } from "./worker-probe.js";
import { DocumentPipeline } from "./document-pipeline.js";
import { OpenProbe } from "./open-probe.js";

let storageOwned = false;

function fixture(count = 200, points = 50, styled = false) {
  return {
    ...DocumentCodec.emptyDocument(),
    strokes: Array.from({ length: count }, (_, id) => ({
      id: id + 1,
      width: styled && id % 2 === 0 ? 24 : 3,
      color: "#182230",
      stabilization: { strength: 65, captureZoom: 1 },
      ...(styled
        ? {
            style: {
              instrument: id % 2 ? "pressure" : "highlighter",
              opacity: id % 2 ? 1 : 0.3,
              pressureStrength: 65,
            },
            matrix: [
              1,
              0.15,
              -0.08,
              1,
              (id % 40) * 160,
              Math.floor(id / 40) * 80,
            ],
          }
        : {}),
      points: Array.from({ length: points }, (_, i) => ({
        x: i * 2 + (styled ? 0 : (id % 40) * 160),
        y: Math.sin(i * 0.7) * 10 + (styled ? 0 : Math.floor(id / 40) * 80),
        pressure: 0.2 + (i % 8) / 10,
        time: i * 4 + 1,
      })),
    })),
  };
}

function stats(values) {
  const sorted = [...values].sort((a, b) => a - b);

  return {
    count: values.length,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    p95:
      sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ??
      0,
    max: sorted.at(-1) ?? 0,
  };
}

async function measure(operation) {
  const tasks = [],
    gaps = [];

  const observer = new PerformanceObserver((entries) =>
    tasks.push(...entries.getEntries()),
  );

  observer.observe({ type: "longtask" });

  let last = performance.now();

  const timer = setInterval(() => {
    const now = performance.now();

    gaps.push(now - last);
    last = now;
  }, 8);

  await new Promise((resolve) => setTimeout(resolve, 0));

  const start = performance.now();
  let result;

  try {
    result = await operation();
  } catch (error) {
    observer.disconnect();

    throw error;
  } finally {
    gaps.push(performance.now() - last);
    clearInterval(timer);
  }

  const end = performance.now();

  await new Promise((resolve) => setTimeout(resolve, 0));
  tasks.push(...observer.takeRecords());
  observer.disconnect();

  return {
    ...result,
    wallMs: end - start,
    taskGaps: stats(gaps),
    longTasks: tasks
      .filter(
        (entry) =>
          entry.startTime < end && entry.startTime + entry.duration > start,
      )
      .map((entry) => ({
        start: entry.startTime - start,
        duration: entry.duration,
      })),
  };
}

async function claimStorage() {
  if (location.origin !== "http://127.0.0.1:4180")
    throw new Error("Owned benchmark origin required");

  const marker = "penable-performance40-owned";
  const databases = await indexedDB.databases();

  if (databases.length && localStorage.getItem(marker) !== "1")
    throw new Error("Origin already has unowned databases; refusing to write");

  localStorage.setItem(marker, "1");
  storageOwned = true;

  return { owned: true, databases: databases.map((entry) => entry.name) };
}

function requireStorage() {
  if (!storageOwned)
    throw new Error("Explicit claimStorage required before durable scenarios");
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);

  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, canonical(value[key])]),
    );

  return value;
}

async function codec(count = 200, points = 50, styled = false) {
  const document = fixture(count, points, styled);
  const json = JSON.stringify(DocumentCodec.encodeDocument(document));
  const results = [];

  for (const phase of ["parse", "export", "snapshot"]) {
    let value;

    results.push(
      await measure(() => {
        const start = performance.now();

        value =
          phase === "parse"
            ? DocumentCodec.parseDocumentJSON(json)
            : phase === "export"
              ? DocumentCodec.serializeDocument(document)
              : DocumentCodec.cloneDocument(document);

        const cpuMs = performance.now() - start;

        return { phase, cpuMs, warning: value.warning ?? "" };
      }),
    );

    const restored =
      phase === "export" ? DocumentCodec.parseDocumentJSON(value.json) : value;

    const summary = DocumentCodec.documentStats(restored);

    if (summary.strokes !== count || summary.points !== count * points)
      throw new Error("Codec lost raw samples");
  }

  return {
    fixture: "codec",
    count,
    points,
    styled,
    bytes: new Blob([json]).size,
    results,
  };
}

async function fileIO(count = 200, points = 50, styled = false) {
  const document = fixture(count, points, styled);
  const json = JSON.stringify(DocumentCodec.encodeDocument(document));
  const file = new Blob([json], { type: "application/json" });
  const probe = WorkerProbe.start();
  let parsed, exported;
  const results = [];

  try {
    results.push(
      await measure(async () => {
        parsed = Document.DocumentReader
          ? await Document.DocumentReader.read(
              file,
              new AbortController().signal,
            )
          : DocumentCodec.parseDocumentJSON(await file.text());

        return { phase: "import-read", worker: !!Document.DocumentReader };
      }),
    );

    results.push(
      await measure(async () => {
        if (DocumentJobs.prototype.export) {
          const jobs = new DocumentJobs();

          try {
            exported = await jobs.export(
              document,
              new AbortController().signal,
            );
          } finally {
            await jobs.close();
          }
        } else exported = DocumentCodec.serializeDocument(document);

        return { phase: "export", worker: !!DocumentJobs.prototype.export };
      }),
    );

    const encoded = JSON.stringify(
      canonical(DocumentCodec.encodeDocument(parsed)),
    );

    if (
      encoded !==
      JSON.stringify(
        canonical(
          DocumentCodec.encodeDocument(
            DocumentCodec.parseDocumentJSON(
              exported.blob ? await exported.blob.text() : exported.json,
            ),
          ),
        ),
      )
    )
      throw new Error("File roundtrip mismatch");

    return {
      fixture: "file-io",
      count,
      points,
      styled,
      bytes: file.size,
      results,
      transfer: probe.snapshot(),
      exact: true,
    };
  } finally {
    probe.stop();
  }
}

async function jobs(count = 200, points = 50, styled = false) {
  requireStorage();

  const document = fixture(count, points, styled);
  const jobs = new DocumentJobs({ boardId: "performance40" });
  const results = [];
  const probe = WorkerProbe.start();

  try {
    for (const phase of [
      "cold-save",
      "warm-save",
      "warm-select",
      "warm-overview",
    ]) {
      const before = probe.mark();

      results.push(
        await measure(async () => {
          const controller = new AbortController();

          if (phase.endsWith("save")) await jobs.write(document);
          else if (phase.endsWith("select")) {
            const selection = await jobs.select(
              document.strokes,
              {
                shape: "rectangle",
                points: [
                  { x: 10, y: -20 },
                  { x: 120, y: 20 },
                ],
              },
              controller.signal,
            );

            return { phase, selected: selection.parts.length };
          } else {
            const overview = await jobs.overview(
              document.strokes,
              controller.signal,
            );

            return { phase, pixels: overview.values.length };
          }

          return { phase };
        }),
      );

      results.at(-1).transfer = probe.since(before);
    }

    const repository = await DocumentRepositoryAdapter.openRepository(
      () => {},
      indexedDB,
      "performance40",
    );

    try {
      const stored = (await repository.read()).main;
      const restored = DocumentCodec.decodeDocument(stored.value);

      const expected = DocumentCodec.decodeDocument(
        DocumentCodec.encodeDocument(document),
      );

      if (
        JSON.stringify(canonical(DocumentCodec.encodeDocument(restored))) !==
        JSON.stringify(canonical(DocumentCodec.encodeDocument(expected)))
      )
        throw new Error("Durable data mismatch");
    } finally {
      await repository.close();
    }
  } finally {
    await jobs.close();
    probe.stop();
  }

  return {
    fixture: "jobs",
    count,
    points,
    styled,
    durableExact: true,
    results,
  };
}

async function session(count = 200, points = 50, cycles = 3) {
  requireStorage();

  const results = [];

  for (let i = 0; i < cycles; i++) {
    let snapshot = DocumentSnapshots.toSnapshot(fixture(count, points));
    const writer = new DocumentJobs({ boardId: "performance40-session" });

    const session = new DocumentSession({
      snapshot: () => snapshot,

      onHydrate: (value) => {
        snapshot = value;
      },

      onState: () => {},

      acquire: DocumentWriterLease.acquireWriterLease,
      open: (invalidated) =>
        DocumentRepositoryAdapter.openRepository(
          invalidated,
          indexedDB,
          "performance40-session",
        ),
      persistence: writer,
      ...(Document.DocumentReader
        ? {
            decode: Document.DocumentReader.decode,
            prepare: Document.DocumentReader.prepare,
          }
        : {}),
    });

    try {
      results.push(
        await measure(async () => {
          await session.start();

          return { phase: "start", cycle: i };
        }),
      );

      snapshot = DocumentSnapshots.toSnapshot(fixture(count, points));
      session.changed();

      results.push(
        await measure(async () => {
          await session.flushOrThrow();

          return { phase: "flush", cycle: i };
        }),
      );
    } finally {
      await session.dispose();
    }
  }

  return { fixture: "session", count, points, cycles, results };
}

async function cancellation(count = 10000, points = 50) {
  const document = fixture(count, points);
  const jobs = new DocumentJobs();
  const controller = new AbortController();

  const pending = jobs.select(
    document.strokes,
    {
      shape: "rectangle",
      points: [
        { x: -10, y: -10 },
        { x: 1000, y: 1000 },
      ],
    },
    controller.signal,
  );

  controller.abort();

  let aborted = false;

  try {
    await pending;
  } catch (error) {
    aborted = error.name === "AbortError";
  }

  await jobs.close();

  if (!aborted) throw new Error("Selection cancellation lost");

  return { fixture: "cancellation", count, points, aborted };
}

async function selectionState(count = 20000, affine = true) {
  const document = fixture(count, 1, affine);

  const selection = new BoardSelection({
    scene: { strokes: document.strokes, active: null },
    viewport: () => document.viewport,
    bounds: () => ({ left: 0, top: 0, width: 1280, height: 720 }),
    writable: () => true,
    select: () => ({
      region: [
        [
          [
            [0, 0],
            [10000, 0],
            [10000, 10000],
            [0, 10000],
            [0, 0],
          ],
        ],
      ],
      parts: document.strokes.map((original) => ({
        original,
        selected: original,
        remainder: null,
      })),
    }),

    validate: () => {},

    commit: () => {},

    preview: () => {},

    changed: () => {},

    setViewport: () => {},
  });

  selection.all();
  selection.nudge(10, 10);

  const optimized = "hasImages" in selection;

  const read = () =>
    optimized
      ? selection.hasImages
      : selection.selected.some((item) => item.kind === "image");

  for (let i = 0; i < 30; i++) read();

  const work = [];

  for (let i = 0; i < 120; i++) {
    const start = performance.now();

    if (read()) throw new Error("Ink-only selection reported image");

    work.push(performance.now() - start);

    if (i % 20 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
  }

  selection.clear();

  return {
    fixture: "selection-state",
    count,
    affine,
    optimized,
    work: stats(work),
    scope:
      "actual selection state projection; excludes renderer/event dispatch",
  };
}

export const ApplicationBenchmark = {
  fixture,
  stats,
  measure,
  claimStorage,
  codec,
  fileIO,
  jobs,
  session,
  cancellation,
  selectionState,

  documentPipeline: (count, replacementOnly) => {
    requireStorage();

    return DocumentPipeline.run(measure, count, replacementOnly);
  },

  openProbe: (cycles, retain) => {
    requireStorage();

    return OpenProbe.run(measure, stats, cycles, retain);
  },

  editorLifecycle: (cycles) => EditorLifecycleBenchmark.run(fixture, cycles),
};
