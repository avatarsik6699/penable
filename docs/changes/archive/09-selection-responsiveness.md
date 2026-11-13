# CHANGE 09 — Область выделения и отзывчивость

## Change Metadata

| Field | Value |
|---|---|
| Change |09|
| Slug |selection-responsiveness|
| Status |shipped locally; owner confirmed Wacom improvement|
| Branch |feature/09-selection-responsiveness|

## Goal

Устранить подтверждённое подвисание и сохранять нарисованную область по уточнению владельца.

## Design References

Существующий светлый компактный UI SPEC5.3; Paint-like region semantics из запроса владельца.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Retain exact rectangle/lasso region across move/nudge/copy/cut/paste/duplicate, blank margins and empty selection; no ink-bounds in cursor/outline — _Depends on:_ —
- [x] F2 Remove measured geometry/bounds bottlenecks with conservative adaptive queries and immutable caches; preserve clips, slivers, holes and accepted raster — _Depends on:_ F1
- [x] F3 Efficient frame-coalesced preview/rendering; profile selection, release, commit/validation/save; cancellable heavy work where needed — _Depends on:_ F2
- [x] F4 PNG region extent and transparent margins; fit-all remains visible-ink based; focus/read-only/cancel guards — _Depends on:_ F1, F2, F3

- [x] F5 Linear replacement history for large scene move/undo/redo; preserve exact object order and same scene array — _Depends on:_ F3

- [x] F6 Reject distant clipped/transformed eraser targets before constructing/intersecting sweep polygons; preserve visible-fragment hits — _Depends on:_ F2

- [x] F7 Bounded-transfer cancellable worker jobs for heavy selection/validation, plus worker-side save serialization/IDB; preserve strict decode/atomic backup/lease/dispose and no stale application — _Depends on:_ F2, F3, D1

- [x] F8 Remove measured53/61ms renderer tasks while dragging20k visible dots; profile first, preserve overlap/AA and exact raster, avoid rebuilding unchanged draw groups per frame — _Depends on:_ F3, F7

- [x] F9 Diagnose owner-reported „strokes: превышен предел“ on selection/drag; inspect actual read-only document counts, prevent artificial fragment growth/over-limit regression and give recoverable limit feedback — _Depends on:_ F1, F2, F7

### Data

- [x] D1 Preserve schema2, atomic history and recovery; optimize repeated trusted runtime validation only with equivalent safeguards — _Depends on:_ F2, F3

### Infra

- [x] I1 Document controls/limits and measured performance evidence in README/STACK — _Depends on:_ F4, D1

### Other

- [x] T1 Regression tests, Fast Gate, changed-file LSP and independent review — _Depends on:_ F1, F2, F3, F4, D1
- [x] T2 Browser before/after performance incl release/drag/save, stress/cancellation, exact area/clipboard/PNG, raster/seams, desktop/narrow/console — _Depends on:_ T1
- [x] T3 Request owner trial; record unverified hardware honestly; Full Gate and automatic local ship after PASS — _Depends on:_ T2, I1

## Files

Frontend: src/drawing/selection.ts, regions.ts, paint.ts, renderer.ts, geometry.ts, png.ts,
hit-test.ts, related tests, optional bounded drawing worker/job helpers; WritingSurface.tsx,
SelectionToolbar.tsx/styles only if required for busy/cancel. Data: codec/session/App only for
measured validation/save integration. Parent owns package/docs/Git/browser/environment.
Do not touch accepted stabilization/curve algorithms, schema/IDB version, old archives,
hosting, user's notes/profile/OS clipboard. No images/fill tools or release.

## Contracts

See SPEC5.9–5.10 and STACK; user explicitly requested exact retained region and performance fixes.

## Gate Checks

STACK Fast/Full; targeted behavioral/performance regressions plus owned-browser timings/long-task
observation. Baseline09:500-point release outline1223.5ms,2000-point1582.9ms in Windows Chrome;
pure selection10.5/14.5ms. Raw measurements in ignored .artifacts/change-09/baseline.json.

## Architect Review Notes

- [x] R1 Analytic circle/long clip-edge intersections lose precision at supported1e9coordinates; projection-based stable roots must preserve dotarc bounds (x.8..1,y±.6).

- [x] R2 Whole-source containment fastpath must not select clipped fragments with no visible ink (off-source mask or hole covering source); retain fastpath for unclipped strokes.

- [x] R3 Cancelled async selection must clear pending progress feedback; Esc cannot leave „Подготовка выделения…“ after busy is false.

- [x] R4 Renderer idle preview(null) must not discard queued pen commits before RAF; rapid penup→blur/Esc/cancel must paint canonical ink immediately, not after later full redraw.

## Implementation Notes

- Final source passed12 accepted-baseline/fractional move-back raster checks and24 direct renderer comparisons across25–800%/DPR1–2, including local clips and fractional translation.
- F7 keeps completed runtime source components immutable by application ownership contract. It captures scene membership/scalars before yielding; arbitrary mutable external snapshots are outside the internal worker API. External decoding and default injected repository adapters retain strict synchronous detachment.
- Geometry and durable persistence have separate worker lifecycles; cancelling selection cannot terminate an autosave transaction.
- Playwriter Profiler.enable is unavailable. Isolated DevTools tracing and native Canvas call instrumentation confirmed F8 overhead; user-owned localhost records were inspected read-only for counts only, with no app loaded in that inspector.
- Owner reported improvement on Wacom, then confirmed the limit error came from the own127 stress fixture already at20kitems. Localhost saved metadata was10strokes/2515points. Preserve caps; replace technical limit feedback with actionable text and test atomic rejection.
- Browser harness historical failures are retained separately: capture-phase microtask timings were not valid handler durations; an early worker harness attempted drag before busy state painted and did not move ink. Final acceptance requires translated outline plus committed Saved state.


## Commit Message

```
fix(change-09): retain selection area and remove interaction stalls
```

Local implementation commit9ccc767. Full Gate PASS: npm ci, both builds/typecheck,338tests/21files, HTTP smoke, lint, secrets scan, dependency audit0vulnerabilities; independent review0unresolved;62distinct browser assertions.

Final browser evidence: exact area/margins/clipboard/empty/lasso, PNG200x120 transparent area, worker cancel/failure/retry,2048vertexlasso, rapid penup→blur, schema1 save failure/retry/recovery, production base-correct worker asset and desktop/narrow console clean. 100k/500k/1M-point notes and final20k-visible-dot drag/save had no >=50ms main-thread Long Tasks. Quantified hardware latency and actual OS clipboard remain unverified; owner confirmed perceived improvement on Wacom.
