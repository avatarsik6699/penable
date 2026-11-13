# CHANGE 10 — Производительность письма и больших конспектов

## Change Metadata

| Field | Value |
|---|---|
| Change |10|
| Slug |writing-performance|
| Status |verified; local ship|
| Branch |feature/10-writing-performance|

## Goal

Последовательная обработка активного штриха и измеримая отзывчивость больших конспектов.
Сохранить привычную геометрию, текущий стек и формат записей.

## Design References

Принятый светлый компактный интерфейс SPEC5.3; визуальный редизайн не требуется.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Incremental active stabilization/curve/path with exact batch-prefix equivalence, immutable completed caches, input/commit/cancel lifecycle and bounded retained state — _Depends on:_ I1
- [x] F2 Diagnose navigation/history/cache memory using equal fixtures; fix confirmed bottlenecks without undo truncation or schema changes; preserve ordering/clips/AA — _Depends on:_ I1, F1

### Data

None — retain schema2/IDB1, strict codec, atomic persistence and all recovery copies.

### Infra

- [x] I1 Reproducible engine/browser fixtures and baseline for writing, pan/zoom, selection/history/save and memory; preserve baseline production and provenance — _Depends on:_ —
- [x] I2 Document executable regression checks, before/after numbers, supported workload and honest limits in STACK/README — _Depends on:_ F1, F2, T2

### Other

- [x] T1 Behavioral/equivalence/complexity regressions, Fast Gate and TypeScript LSP — _Depends on:_ F1, F2
- [x] T2 Owned-browser production comparison, raster equivalence, long-session/memory, persistence/recovery, desktop/narrow console; independent review — _Depends on:_ T1
- [x] T3 Full Gate and automatic local ship; disclose unverified physical Wacom trial — _Depends on:_ I2, T2

## Files

Create/modify: src/drawing/{stabilization,source-geometry,geometry,paint,renderer,history}.ts,
related bounded helpers/tests; benchmark fixtures/runner; README.md, docs/{SPEC,STACK}.md.
Measured F2 fixes may touch hit-test/eraser with explicit Backlog detail first.
Parent owns docs/tooling/browser/environment/Git. One source writer.
Do not touch hosting, accepted UI, old archives, schema/IDB versions, user's notes/profile,
OS clipboard or release/push. No images/transforms/new drawing SDK or undo cap.

## Contracts

See SPEC3,5.9–5.11 and STACK. Owner approved measurements + optimization in chat.

## Gate Checks

STACK Fast/Full plus same-fixture before/after production timings, >=50ms LongTasks,
prefix/raster comparisons and memory lifecycle checks. Baseline main4c71f13.
Artifacts are ignored .artifacts/change-10; reusable harness must be tracked.

## Architect Review Notes

- [x] R1 Benchmark eraser excludes preview redraw: label hit-test-only; enforce raster/result/ordinary-long-task failures in reusable runner after saving artifacts.

## Implementation Notes

- Three alternating warmed engine pairs (Chrome157, DPR1.215, identical1px capture) show median p95 batches10k ink2.2→0.5ms,50k ink13.2→2.4ms; no attributable long tasks. Native capture bypasses observed1Hz scheduling; these are engine/main-thread timings, not pen-to-photon latency.
- Navigation/hit-test profiling did not justify adding a spatial index. Dense20k visible objects remain a stress workload with nontrivial redraw cost. Browser explicit GC is unavailable; Node cache ownership check releases400/400 weak references, but browser/GPU reclamation and multi-hour hardware usage remain unverified.
- Production app smoke:27assertions passed (native mouse, full/partial selection, eraser, undo/redo,100k import/move/save/reload, backup preservation, forced worker failure/retry, JSON payload, desktop/narrow and fresh console). Three corrected harness assumptions remain in raw evidence: fractional canvas origin, JSON key order, historical favicon log. Download payload was inspected; OS filesystem save and Wacom were not claimed.
- Baseline serialized history growth74,557,939bytes→66,439bytes for500single-item edits among20kloaded objects; full undo/redo retained. Native raster672comparisons exact.

## Commit Message

```
refactor(change-10): optimize handwriting and board history
```

Full Gate PASS in clean snapshot: npm ci, both builds, tsc,408tests/22files, lint, secrets0, audit0; browser27assertions,672native raster comparisons, desktop/narrow,100k worker move/save/failure/retry and HTTP/assets200. Fresh gate production bytes match browser-tested files. Independent source and harness review resolved. Actual Wacom latency, browser/GPU retained-memory reclamation and OS filesystem download remain unverified. No release authorized.
