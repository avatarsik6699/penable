# CHANGE 40 — Full application performance audit

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `40` |
| Slug | `performance-audit` |
| Title | Full application performance audit |
| Status | `shipped` |
| Branch | `feature/40-performance-audit` |

## Goal

Execute the owner-approved deep performance audit and repair confirmed bottlenecks throughout
Penable. Prioritize Windows Chrome/installed desktop/Wacom, preserving exact ink, all raw samples,
image quality, selection, history and durable note data. Internal caches/indexes/Workers may change
when measurements prove benefit; React/TypeScript/Canvas2D and existing formats remain.

## Backlog

### Frontend
- [x] `F1` Measure and repair confirmed main-thread import/export/autosave/startup/worker-transfer bottlenecks; preserve errors, download recovery, cancellation, authority, ordering and durable roundtrips. — _Depends on:_ T1
- [x] `F2` Measure input/render/navigation/selection/history/mixed content and repair confirmed repeated work or responsiveness defects; preserve native raster and event ownership. — _Depends on:_ T1
- [x] `F3` Verify actual editor/image/worker/persistence lifecycle and retained resources across repeated board/import/reload transitions; repair confirmed lifetime defects. — _Depends on:_ T1

### Infrastructure
- [x] `I1` Integrate bounded deterministic work/integrity regressions into existing CI and document reproducible native performance commands, without machine-dependent timing gates in shared CI. — _Depends on:_ F1, F2, F3, T2

### Other
- [x] `T1` Pin baseline7e83844, establish scenario/fixture/metric coverage and application-level measurement harness using isolated owned data. — _Depends on:_ —
- [x] `T2` Complete cold/warm native before/after measurements, first3 valid warmed pairs, raster/integrity/worker and stress/cancellation/memory checks; record confirmed/unconfirmed candidates and remaining limits. — _Depends on:_ F1, F2, F3
- [x] `T3` Independent review and Fast/Full Gate acceptance for automatic ship/release; publication follows the Gate Checks delivery contract. — _Depends on:_ I1

## Files

### Create / modify
- `scripts/performance/` — existing actual-engine harness plus full application/codec/session/worker/lifecycle scenarios and runner/receipts.
- `src/features/board-document/` — only measured persistence, import/export, codec, jobs, lifecycle repairs and their tests.
- `src/widgets/board-workspace/` — only measured event/render/selection/export integration and tests.
- `src/entities/board/` — only measured pure geometry/input/history/selection repairs and tests.
- `src/shared/` — only required existing shared platform contracts/i18n strings for preserved feedback.
- `e2e/` — owned data/fixtures/Page Objects and bounded integrity/work regressions.
- `scripts/architecture/` — exact reviewed platform-owner/test boundary extensions only if needed.
- `package.json`, `.github/workflows/pages.yml` — repository commands and bounded CI verification.
- `docs/STACK.md`, `docs/KNOWN_GOTCHAS.md` — measurement commands, coverage and recurring traps.
- `docs/performance/40-audit.md` — measured audit results, reproduction and remaining limits.

### Do NOT touch
- Document5/catalog2/IDB1 formats, backward reading/recovery semantics, pen quality, raw samples,
  bitmap budgets, user notes/origins, external production data, dependencies or unrelated design.

## Contracts

See `docs/SPEC.md` §3–§5.12, §5.16–§5.27 and `docs/FRONTEND.md`. The approved plan adds measured
coverage and internal optimizations, not new product features or a change of rendering stack.

## Gate Checks

Standard [STACK.md](../../STACK.md) gates plus full app scenario coverage. Baseline captured from
7e83844 in `.artifacts/change-40/baseline/`. Native benchmark4180; owned Pages4220; isolated E2E4185.
Ordinary200×50 and500/2000-point ink; large2000/10000×50; long10k/100k; stress20k/1M; dense,
pressure/highlighter, affine/clip, images/math and100-board library. Track cold/warmCPU, frames,
p50/p95/max, attributable>=50ms tasks, worker transfer, durable completion and owned-resource
release. No foreground/RAF inference from task scheduling or browser/GPU inference from NodeGC.
First3 valid warmed pairs: medianp95<=max(1ms,baseline×1.2) for regressions; targeted fixes require
repeatable measured gains. Full Gate/review precede automatic `ship --release`, explicitly requested.

## Architect Review Notes

- [x] Independent review: abort active startup before library drain; preserve emergency export on Worker failure. Fixed and re-reviewed.
- [x] Actual blocked-worker E2E: startup strict decoding also retains its independent fallback; fixed and re-reviewed.

## Implementation Notes

- Worker fallback is deliberately synchronous only when background processing fails, preserving
  startup and emergency export independently of Worker availability. Normal file processing stays async.
- Native structured clone/IndexedDB and accumulated Canvas path rasterization remain explicit
  limit-scene costs; no samples, validation or raster quality were removed to disguise them.

## Commit Message

```
perf(change-40): remove measured application processing stalls
```
