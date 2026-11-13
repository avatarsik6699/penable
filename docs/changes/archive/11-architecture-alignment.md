# CHANGE 11 — Архитектура и композиция

## Change Metadata

| Field | Value |
|---|---|
| Change |11|
| Slug |architecture-alignment|
| Status |shipped locally|
| Branch |feature/11-architecture-alignment|

## Goal

Перенести применимые архитектурные правила и композицию infraegev2 с обязательными проверками.
Сохранить поведение, документы, качество письма, геометрию и производительность.

## Design References

Approved compact light UI SPEC5.3; no visual redesign. Architecture source: reference FRONTEND2–4/6,
actual route/feature/entity and reading-position adapter flows; reference checkout remains read-only.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Extract pure entities/board, contracts/IDs/limits and semantic ports; remove codec/protocol reverse deps, separate native Path2D/mask tracing; retain all algorithms/assertions — _Depends on:_ I1
- [x] F2 features/board-document: DTO vs BoardSnapshot, model/adapters/session/worker/import-export separation; exact schema/raw recovery/lease/disposal and two-worker lifetimes — _Depends on:_ F1
- [x] F3 widgets/board-workspace runtime/presenters/bindings and thin app/React views; cached coarse UI snapshot, synchronous guards and tab clipboard lifetime — _Depends on:_ F1, F2
- [x] F4 Full FRONTEND code shape, colocated CSS Modules/semantic tokens/shared real controls; no old flat tree/compat engine, no UI changes — _Depends on:_ F3

### Data

- [x] D1 Verify schema1/2/IDB1/backup/corrupt-data/atomic import, worker error/retry/drain and writer lease unchanged — _Depends on:_ F2, F3

### Infra

- [x] I1 Capture immutable5624f9e baseline production/source/fixtures, binding frontend contract and plan — _Depends on:_ —
- [x] I2 AST architecture/code-shape/platform/worker policies + positive/negative fixtures; Oxlint/Prettier/editor config and documented lint/format commands — _Depends on:_ F4
- [x] I3 Adapt benchmark entrypoints to actual refactored runtime/core while preserving baseline; keep tests on same geometry, no duplicate implementation — _Depends on:_ F1, F3
- [x] I4 Small Playwright fixtures/Page Objects suite on isolated Pages4185, CI uses same built artifact; preserve Playwriter interactive priority — _Depends on:_ I1, F3

### Other

- [x] T1 Fast Gates, LSP, unchanged unit assertions + ownership/lifecycle regressions and independent architecture/source review — _Depends on:_ F1, F2, F3, F4, I2
- [x] T2 Native raster672,3paired before/after timings, storage/worker/browser/desktop/narrow/fresh console; all acceptance on production paths — _Depends on:_ T1, D1, I3, I4
- [x] T3 Full Gate and automatic local ship; report hardware/GPU limits honestly — _Depends on:_ T2

## Files

Source writer: entire src/ and colocated tests, native styles and public APIs.
Parent: docs/AGENTS/README/package/lock/Vite/TS/Oxlint/Prettier/Playwright configs, e2e/,
scripts/performance, CI, browser/env/Git. Policy writer may own scripts/architecture only.
Do not mutate infraegev2, old archives, user notes/Chrome profiles, schema/IDB versions or release.

## Contracts

See SPEC3,5.9–5.12, FRONTEND and STACK. User explicitly approved full architecture/style and E2E.

## Gate Checks

STACK Fast/Full plus architecture/self-tests, format, isolated E2E and exact raster/paired timings.
Baseline5624f9e captured under ignored .artifacts/change-11. Style-only docs/source moves do not
justify weakened tests; worker native asset paths and lifecycle require runtime acceptance.

## Architect Review Notes

- [x] R1 Restore native ResizeObserver.observe device-pixel box with fallback and adapter regression coverage (independent review).

- [x] R2 Enforce exact platform capabilities for static bracket access, with positive/negative policy fixtures (independent review).

## Implementation Notes

- Native raster672 comparisons exact. Three alternating pairs against5624f9e: median CPU batch p95 ink10k0.5→0.6ms, ink50k2.4→2.3ms, navigation10k2.5→2.5ms, dense20k14.4→11.4ms; all within max(1ms,baseline*1.2), no ordinary attributable>=50ms tasks. Same1px capture restores observed native RAF throttling for both builds; this is not physical pen-to-photon latency.
- All408 original unit cases retained; eight lifecycle/resize regressions added. Independent review found missing ResizeObserver observation and bracket-access policy bypass; both fixed with behavioral/positive-negative tests. Architecture selftests36.
- Browser suite uses fixture-owned data and native input, including schema1 recovery copies, atomic import, read-only lease, separate worker failure/retry and100k-point worker selection/move/undo/redo/reload. Large scene equality uses SHA256 over canonical full content to keep failed polling comparisons bounded; application storage paths remain unchanged.
- Chrome desktop/narrow layouts inspected through Playwriter, fresh console clean.672 raster comparisons exact; Node400/400 weak references released and500 history replacements retained66439bytes growth. Browser/GPU retained-memory and Wacom hardware latency not remeasured. No release/push authorized.

## Commit Message

```
refactor(change-11): align board architecture and code composition
```


## Full Gate — PASS

Run on a clean source snapshot; final Pages JS/CSS/worker/HTML bytes match browser-tested dist.

| Check | Result |
|---|---|
| npm ci | PASS |
| Root build / Pages build / typecheck | PASS |
| Unit tests | PASS416 /24files |
| Oxlint / architecture policies | PASS |
| Architecture self-tests | PASS36 |
| Formatting | PASS |
| Isolated Pages E2E | PASS9, including100k-point worker roundtrip |
| Interactive smoke / accessibility | PASS desktop/narrow, labels/focus/keyboard; formal audit deferred per STACK |
| Secrets | PASS0 |
| Dependency audit | PASS0 |
| Raster / paired performance | PASS672 exact;3pairs within agreed thresholds |
| LSP | PASS no errors/warnings;6 informational source suggestions/deprecation |
| Architect Review Notes | PASS0 unresolved |
| Backend / migrations / containers | n/a per STACK |
| Release | Not requested; local ship only |

Implementation commit a46432e; merged fast-forward to local main. No push/deploy performed.
