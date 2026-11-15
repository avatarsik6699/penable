# Application performance audit — change 40

Baseline: `7e83844` (shipped change39). Native measurements: Windows Chrome157,
DPR1.21458, visible1582×669 window,1280×720 benchmark canvas. Source snapshots and
SHA-256 provenance are captured by `bench:build`; no application diagnostics ship.

The audit measures actual source entrypoints, the native editor, real module Workers and
IndexedDB. The full Pages browser suite separately exercises the React application.
Synthetic input is not physical Wacom latency or GPU memory acceptance.

## Confirmed causes and changes

- File import and export previously synchronously parsed, cloned, encoded and validated the
  entire document on the UI thread. Strict codec semantics now run in Workers; imported
  points return in2048-point chunks, metadata in64-item batches and assets in65536-character
  chunks. Export returns a Blob, avoiding a large string in the UI download path.
- Stored-board startup/switching and import preparation previously ran strict decode on the
  main thread. Production owners inject asynchronous decoding/preparation while preserving
  raw recovery records, atomic replacement and cancellation. Native structured cloning of
  stored/runtime inputs remains an explicit cost.
- Selection UI status transformed/copied every selected item just to answer whether an image
  was selected. `hasImages` scans membership without constructing transformed geometry.
- Independent review caught delayed cancellation during library startup and Worker-dependent
  emergency export. Eager child disposal preserves drain-before-lease-release ordering;
  non-cancellation Worker failure retains the synchronous emergency export path.

## Paired native results

Use the first3 valid warmed alternating baseline/candidate pairs, without selecting the best
runs. Invalid fixture/cadence/context runs are excluded before acceptance. Work p95 is CPU time
per engine batch. File responsiveness is the median of each operation's maximum8ms timer gap
(actual Windows timers commonly have a15–16ms floor), not FPS or total processing time.
Native Long Tasks are recorded separately.

### Import/export

| Fixture | Import max gap, before→after | Export max gap, before→after | Import/export Long Tasks before→after, all3 runs |
|---|---:|---:|---:|
| 200×50 | 27.6ms→17.9ms | 27.1ms→15.6ms | 0/0→0/0 |
| 2000×50 | 227.8ms→16.3ms | 235.8ms→23.3ms | 3/3→0/0 |
| 10000×50 | 1194.1ms→29.9ms | 1464.7ms→92.2ms | 3/3→0/0 |
| 1×100000 | 237.9ms→16.2ms | 272.0ms→20.9ms | 3/3→0/0 |
| 2000×50 styled/affine | 313.2ms→17.3ms | 321.4ms→19.4ms | 3/3→0/0 |

Worker startup and chunk scheduling increase total file-operation wall time. For100k ordinary
points, warmed import wall time was approximately236→359ms and export236→392ms; the gain
is responsiveness, not faster completion. Integrity comparisons run outside the timed phase.

### Selection state and native drawing

| Scenario | Median work p95 before→after |
|---|---:|
| 5000 affine selected items, status projection only | 1.50→0.10ms |
| 20000 affine selected items, status projection only | 7.70→0.30ms |
| ink 500 | 0.50→0.40ms |
| ink 2000 | 0.50→0.60ms |
| ink 10000 | 0.60→0.70ms |
| ink 10000 pressure | 1.30→1.30ms |
| ink 10000 highlighter | 0.60→0.70ms |
| navigation 200 | 0.50→0.40ms |
| navigation 2000 | 1.00→0.80ms |
| navigation 10000 | 2.50→2.50ms |
| navigation 20000 | 18.30→19.10ms |
| history 20000 | 0.30→0.20ms |

All10 engine CPU fixtures satisfy medianp95≤max(1ms,baseline×1.2). The20k dense
all-visible scene requires about19ms work per navigation frame; the audit does not promise
60FPS at the document limits. Viewport culling cannot discard overlapping visible geometry.

### Persistence and startup

Repeated100k-point session startups reduced median maximum UI task gap246→41ms;
attributable Long Tasks across9 starts fell10→1 (remaining maximum56ms). This is a
measured improvement with a remaining native clone/IndexedDB cost, not a zero-stall claim.

Ordinary/styled200/2000-item save, selection and overview jobs produced no Long Tasks in the
paired runs. Cold saves uploaded every raw point; warm saves/selection/overview uploaded zero
point chunks for unchanged source identities. Durable records matched all geometry and settings.
Timer p95 for short asynchronous jobs is dominated by timer granularity and small sample counts;
it is reported in raw receipts and is not used as an engine CPU regression threshold.

## Integrity, resources and coverage

- Native raster:672 legacy plus192 instrument active/commit comparisons, zero differences.
- Actual renderer mixed styles/math scene:600 items,90 viewport updates; no raster shortcut.
- Native editor lifecycle:12 generations with pressure/highlighter/affine ink, images and
  selection Workers. Workers terminated; decoded bitmaps closed, including late completions;
  no owned event listeners, queued RAF or ResizeObservers remained.
- Node explicit-GC check:534 weak references for200×1000-point ordinary/styled/pressure
  geometry, zero retained. This is JS ownership evidence, not browser/GPU memory evidence.
- New CI browser regression imports100k points, checks every raw sample, downloads3 exact
  copies, checks bounded transfer and released temporary Workers, then reloads the durable scene.
- Existing CI scenarios retain pen recovery/eraser/history, selection transforms/cancellation,
  image/PNG/clipboard/math, board authority, migration/recovery, offline and touch coverage.
- Worker-failure regression downloads pending ink before allowing Worker network recovery,
  then verifies exact save and reload. Runtime errors are not filtered outside deliberate faults.

## Reproduce

Capture baseline source before modifications (the audit used `.artifacts/change-40/baseline/src`).
Use existing `npm run bench:build` with `PENABLE_BENCH_SOURCE` and `PENABLE_BENCH_OUT` for
each build. Both outputs must be served at `http://127.0.0.1:4180/baseline/` and `/candidate/`;
use the repository Vite preview with `.artifacts/change-40/bench` as outDir and strict4180.

Create one owned Playwriter tab/session, then set `state.label` to baseline/candidate, `state.pair`
to1/2/3 and `state.suite` to engine/files/jobs/selection/raster. Run
`scripts/performance/audit.js` with Playwriter `-f` and an explicit45000ms budget. Alternate
builds; keep the first3 valid warmed pairs. The runner rejects invalid initial RAF cadence.
Receipts are written to `.artifacts/change-40/audit-*.json`, including browser and source provenance.

`applicationBench.editorLifecycle(12)` exercises real native editor ownership;
`applicationBench.fileIO(20000,50)` is the1M-point boundary. `npm run bench:lifecycle`
checks weak geometry ownership. `npm run test:e2e:run -- e2e/performance/performance.spec.ts`
checks the production Pages application after `npm run build:pages`.

`jobs`/`session` explicitly claim storage only on the reserved benchmark origin. They refuse an
origin with an existing unmarked database. Do not run these scripts on a personal/production
origin. Hardware timing is local evidence; CI asserts work bounds, integrity and ownership.

## Remaining boundaries

Native structured clones, previous-board backup capture, IndexedDB replacement and first cold
geometry/raster preparation can still be expensive near1M points. They preserve isolation and
recovery; this change does not skip validation, drop samples or reduce bitmap quality to hide
those costs. Error-only synchronous fallback may block while rescuing data. Physical Wacom feel,
Chrome/PWA process memory and GPU/driver memory require their own device acceptance.

### Additional native application and boundary checks

The actual Pages application at the isolated owned4220 origin loaded a100-board library with
200styled/affine strokes and an embedded image on the active board. Six switches between the
mixed board and an empty board completed in208–295ms each, with no observed Long Tasks. At
idle, all14temporary readers were terminated; image bitmap counts tracked replacement and the
one current board cache. Desktop screenshot and fresh console were checked through Playwriter.

A100k-point ordinary continuous stroke completed with one commit and all100000raw points,
unchanged page time origin. JS batch CPU p95 was2ms, but native raster/frame p95 was94.7ms,
with226Long Tasks. This deliberately overlapping166-pass trajectory exposes accumulated Canvas
path rasterization cost outside the short JS scheduling measurement. It is a documented limit,
not a passed60FPS claim. Incremental raw geometry/path preparation already consumes new samples
only; reducing native redraw requires a separately validated raster strategy within bitmap and
exact-appearance constraints. The audit leaves this cost visible rather than discarding points.

Two initial awaited long-benchmark probes hit Playwriter's separate30s CDP deadline. Starting the
operation in-page and polling its result established completion and integrity without misreporting
that automation error as an application crash. See KNOWN_GOTCHAS for the relay behavior.

The corresponding100k pressure stroke also committed exactly100000points: JS work p95
12.3ms, frame p95114.7ms,261Long Tasks on this overlapping boundary fixture. These results
separate incremental CPU work from deferred native Canvas raster cost; neither is ordinary
handwriting acceptance. No renderer/geometry shortcut was introduced for these boundary numbers.

The final1M-point (20000×50) file boundary roundtrip retained every sample and closed both
Workers. Import wall1.83s/maxgap33.3ms; export wall2.45s/maxgap399.6ms; neither emitted an
attributable Long Task in that run. The large export gap remains observable even with Blob output
and is recorded as a stress limitation, not described as smooth ordinary interaction.

Browser `HeapProfiler.collectGarbage` was unavailable through the active Playwriter CDP bridge
(protocol method not found). Browser retained-heap/GPU claims therefore remain unverified;
resource disposal counters and the separate Node weak-reference check are the available evidence.

## Delivery acceptance

Independent review passed after cancellation and Worker-failure recovery corrections. Full Gate
passed: clean npm bootstrap, default/Pages builds,773unit tests in70files,133browser scenarios
(Chromium and bounded WebKit touch), docs/archive checks, lint/format/types, secrets and dependency
audit. Physical Wacom acceptance and browser/GPU retained-heap measurement remain separate.
Publication is verified against the exact pushed main SHA through GitHub Actions and live asset
byte comparison; deployment receipts are local artifacts rather than production application data.
