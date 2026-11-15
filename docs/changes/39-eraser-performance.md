# CHANGE 39 — Responsive whole-stroke erasing

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `39` |
| Slug | `eraser-performance` |
| Title | Responsive whole-stroke erasing |
| Status | `active` |
| Branch | `feature/39-eraser-performance` |

## Goal

Identify and repair whole-element eraser freezes, especially on pressure and transformed ink.
Measure actual hit-testing, preview and commit costs before/after while preserving exact erasure,
whole-gesture undo/redo, cancellation and durable saved content.

## Backlog

### Backend
None

### Frontend
- [x] `F1` Reproduce eraser stalls with pressure/transformed/clipped ink; bound expensive hit-testing to nearby candidates, reuse gesture-derived calculations, and verify unchanged sweep/cancel/history/save behavior. — _Depends on:_ —

### Other
- [x] `T1` Add representative native eraser benchmarks including preview redraw/commit, record paired baseline/candidate evidence, run required focused checks and independent review. — _Depends on:_ F1

## Files

### Create / modify
- `src/entities/board/input/hit-test.ts`
- `src/entities/board/input/hit-test.types.ts`
- `src/entities/board/input/hit-test.test.ts`
- `src/entities/board/regions/modules/ink/ink-intersections.ts`
- `src/entities/board/regions/regions.test.ts`
- `scripts/performance/engine.js`, `scripts/performance/eraser.js`
- `e2e/data/boards.ts`, `e2e/fixtures.ts`, `e2e/pages/board-page.ts`, `e2e/board.spec.ts` (focused regression if required)
- `docs/KNOWN_GOTCHAS.md` (if warranted)

### Do NOT touch
- Storage schemas, document formats, pen-focus recovery, visual design, pressure rendering, dependencies.

## Contracts

See `docs/SPEC.md` §3–§5.7, §5.9, §5.19 and `docs/FRONTEND.md`; preserve current exact geometry,
clip/transform behavior, eight CSS pixel eraser radius, coalesced sweeps and transaction ownership.

## Gate Checks

Standard [STACK.md](../STACK.md) Fast/Full Gates. Native Pages preview4219, isolated E2E4185,
actual-engine benchmark4180. Baseline source is captured before edits in the ignored
`.artifacts/change-39/baseline-src`; build baseline/candidate through the existing bench commands.
Include pressure/transformed distant misses, sparse crossings, coalesced sweeps, preview rendering,
commit/undo/redo/cancel and saved reload. Preserve baseline native raster comparisons and report
hardware comfort separately. Automatic local ship is authorized; publication is a separate release.

### Verification evidence

- Four new deterministic query-work tests failed on baseline and passed after repair. Focused
  unit suite:62 tests; Fast Gate lint/architecture/format/types/docs and changed-file LSP clean.
- Dense800-item E2E passed: preview actually changes pixels, Escape restores exact PNG, three
  pressure/affine/clipped strokes erase as one transaction; exact fingerprints and pixels restore
  through undo/redo, erased document survives reload. Independent review found no defects.
- Paired actual Windows Chrome CPU probes include real renderer preview flush and commit/history.
  MessageChannel task scheduling was explicit to avoid background RAF throttling; these are
  CPU/Long Task observations, not a claim about physical frame cadence or Wacom latency.

| Scene / sample batch | Baseline p95 | Candidate p95 | Long Tasks before / after |
|---|---:|---:|---:|
| 800 pressure strokes,4 samples |76.1ms|2.0ms|6 /0|
| 800 affine pressure strokes,4 samples |94.4ms|2.4ms|6 /0|
| 800 clipped affine strokes,4 samples |125.6ms|4.8ms|6 /0|
| 2000 affine ordinary strokes,12 samples |600.4ms|8.3ms|6 /0|
| 2000 pressure strokes,12 samples |585.7ms|3.7ms|6 /0|

- All paired cases retained identical hit counts and history restoration. Baseline/candidate
  native raster checks:672 legacy and192 pressure/highlighter comparisons each, zero differences.
- Actual application mouse drag on the owned800-stroke localhost4219 board durably changed
  count800→797, then Undo restored it. Fresh application console was clean. The preceding
  standalone manifest seed navigation produced a favicon404; it was not an app runtime error.
  Playwriter screenshot timed out; isolated DevTools supplied actual-engine visual evidence.
- Owner tested Wacom erasing over the prepared800-stroke local board and confirmed
  “Проверил, все работает” (checked, everything works). Acceptance covers this local eraser
  scenario; do not generalize it to arbitrary near-limit documents. Personal notes were untouched.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- A spatial index and renderer redesign were deferred because paired measurements isolated
  the stall to per-candidate polygon work. Existing gesture-local weak ownership now caches
  conservative world bounds/inverses and one sweep; exact nearby geometry stays authoritative.
  Full-scene scanning and preview redraw still exist, so no universal near-limit speed promise.


## Commit Message

```
fix(change-39): avoid expensive eraser work for distant ink
```


## Full Gate

| Check | Result |
|---|---|
| Bootstrap | PASS — npm ci, unchanged lockfile |
| Frontend build / types | PASS — npm run build, strict tsc, changed TS LSP diagnostics clean |
| Pages artifact | PASS — npm run build:pages; existing chunk-size advisory retained |
| Unit suite | PASS — 748 tests /66 files |
| Documentation / archive | PASS —85 local links and34 preserved ZIP entries |
| E2E lint / determinism | PASS — lint, architecture/spacing policies and self-tests, format:check |
| E2E suite | PASS —132 Chromium/WebKit scenarios,5.2 minutes |
| Smoke / accessibility | PASS for scope — actual Windows Chrome erasing/Undo/save on800 synthetic strokes and clean fresh app console; existing labels/keyboard preserved; exact preview/cancel/undo pixels covered by E2E; screenshot fallback shows actual native painter |
| SAST | PASS — repository lint and architecture checks |
| Secrets | PASS — Gitleaks, no leaks |
| Dependencies | PASS — npm audit, zero vulnerabilities |
| Performance | PASS — paired native eraser CPU/Long Task results above; no samples dropped; no loss of hit count/history behavior |
| Raster | PASS —672 legacy +192 styled comparisons each on baseline/candidate, zero differences |
| Independent review | PASS — no findings; clipped-item durability and preview-pixel coverage gaps were addressed and re-reviewed |
| Architect Review Notes | PASS — zero unchecked issues |
| Hardware feedback | PASS for tested scenario — owner checked erasing with Wacom over the prepared800-stroke local board |
| Formal automated accessibility audit | Deferred per STACK; no new interactive controls |
| Backend / migrations / containers | n/a — browser-only application, no schema change |
| Release | Not requested; local delivery only |

Context7 returned monthly quota exhaustion; official polygon-clipping, Vitest and browser API
references were used as the documented fallback. Logs: `/tmp/penable-39-full-*.log`. Paired
receipts and saved baseline source are in the ignored `.artifacts/change-39/` directory.
Owned automation tabs/sessions, benchmark server and dev server were closed. Pages preview4219
remains available for the owner's synthetic Wacom board; existing other previews were preserved.
