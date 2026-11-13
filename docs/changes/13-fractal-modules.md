# CHANGE 13 — Фрактальная декомпозиция модулей

## Change Metadata

| Field | Value |
|---|---|
| Change |13|
| Slug |fractal-modules|
| Status |active|
| Branch |feature/13-fractal-modules|

## Goal

Сохранить направления зависимостей app→widgets→features→entities→shared, но рекурсивно разделить
крупные модули по обязанностям. Компоненты, настоящие hooks, контракты, чистые алгоритмы и
конфигурация должны иметь локальных владельцев и понятные public API.

## Design References

infraegev2 FRONTEND2–3 and actual lesson-practice/course-catalog components/model composition,
read-only reference. hooks/ and *.utils/*.config naming are this owner's explicit Penable extension,
not a convention claimed to exist in the reference. Preserve current light UI and all behavior.

## Backlog

### Frontend

- [x] F1 Fractal component roots with components/, actual hooks/, scoped .types/.config/.utils; decompose toolbar/storage/import/selection/cursor presentation and workspace/surface React wiring — _Depends on:_ I1
- [x] F2 Decompose native editor composition, pointer/keyboard/cursor/edge-pan bindings and renderer responsibilities into cohesive local modules; retain synchronous guards and generation cleanup — _Depends on:_ I1
- [x] F3 Decompose pure board modules: regions algorithms/cache/parts, selection contact/jobs/clipboard/transactions and geometry/input/history/navigation ownership; split types/config/helpers without algorithm changes — _Depends on:_ I1
- [x] F4 Decompose document codec/snapshots/validation, jobs protocol/transport/upload/lifecycle and session save/import/startup responsibilities, preserving schema1/2/IDB1/recovery and two-worker lifetimes — _Depends on:_ I1

### Infra

- [x] I1 Capture baseline4345ce1; binding fractal module contract/SPEC, exact ownership plan and source branch — _Depends on:_ —
- [x] I2 Enforce child public roots, actual hook/type/config placement and prevent private/ancestor-barrel escapes/cycles; update exact platform registry and positive/negative fixtures — _Depends on:_ F1, F2, F3, F4
- [x] I3 Adapt test/benchmark entrypoints to actual module APIs, preserve engine fixture coverage and Pages worker assets — _Depends on:_ F2, F3, F4

### Other

- [x] T1 Fast Gates, LSP, all416 existing unit cases, meaningful lifecycle/ownership regressions and independent decomposition review — _Depends on:_ F1, F2, F3, F4, I2
- [x] T2 Production browser9 scenarios plus meaningful native/performance comparison against4345ce1, desktop/narrow/fresh console and import/writer boundaries — _Depends on:_ T1, I3
- [x] T3 Full Gate and automatic local ship; no push/deploy — _Depends on:_ T2

## Files

One writer owns all src/ including tests/styles and local exports. Root owns docs/AGENTS/README,
scripts/architecture, scripts/performance, package/config/e2e adjustments, browser/env/Git/gates.
Read-only reference; do not modify archives/user data/Chrome profiles/dependency stack or schemas.

## Contracts

SPEC5.12–5.13 and FRONTEND. Top owner APIs stable where practical; no legacy shim tree or duplicated
engine. No empty folders, invented hooks/global store, generic shared dumping grounds, method-forwarding
proxy classes or suffix-only renaming. Decomposition follows state/algorithm ownership; line count is
review evidence, not a reason to split cohesive functions. Preserve spacing conventions from12.

## Gate Checks

STACK Fast/Full; independent review must inspect real responsibilities and state ownership, not just
folder names. Preserve existing assertions/raster coverage. If native benchmark bytes change, run672
raster cases and3paired CPU timings (median p95≤max(1ms,baseline×1.2), no ordinary attributable>=50ms task).
Browser runtime required for changed component/native module composition and worker bundling.

## Architect Review Notes

- [x] R1 Extract actual selection gesture/contact state machine from the transaction coordinator with narrow outcomes/ports and single contact ownership; preserve cancellation, draft outline, dynamic shape and edge-pan behavior.

## Implementation Notes

- Recursive modules adapt reference composition; hooks/ and .utils/.config naming are the owner's explicit extension. Child public APIs are enforced without requiring empty directories. Existing top-owner APIs stay stable, so benchmark entrypoints still consume the actual engine through supported roots.
- Four reviewed coordinators intentionally remain above300lines: BoardSelection495 owns canonical membership/previews/atomic acceptance, DocumentSession402 owns one revision/queue/lease lifecycle, WorkspaceModel346 owns tab/session/cached UI state, EditorRuntime342 composes one editor generation and its disposal. Gesture sampling, commands, algorithms, transport and rendering have separate real owners. Further method-level splitting would obscure ownership.
- Independent source review compared37 region algorithm bodies,24 binding closures and13 renderer/painter methods to the baseline after import/namespace normalization; caches remain singular. All416 baseline unit cases preserved, four gesture-owner regressions added. Codec/schema recovery and worker reset/upload/drain order retained.
- Native raster672 exact. Three alternating warmed pairs against4345ce1: median CPU batch p95 ink10k0.5→0.6ms, ink50k1.9→1.8ms, navigation10k3.0→3.0ms, dense20k16.9→14.0ms; each within max(1ms,baseline×1.2), no measured long tasks. Same1px capture/RAF conditions for both. Normal native mouse ink600samples/selection/move/undo also had0long tasks in both app builds, with unchanged backing sizes and fresh console.
- Browser regression preserves original9cases and adds computed cursor shapes, pan/modal ownership and keyboard slider settings reaching saved raw ink. Physical Wacom latency, OS clipboard writing and browser/GPU reclamation remain separately unverified. Node cache ownership releases400/400weakrefs; history retains66439bytes growth for500single-object edits with undo/redo intact. No push/release.

## Commit Message

```
refactor(change-13): decompose board into fractal modules
```


## Full Gate — PASS

Clean snapshot; final Pages HTML/JS/CSS/module-worker bytes match the browser-tested dist.

| Check | Result |
|---|---|
| npm ci | PASS |
| Root build / Pages build / typecheck | PASS |
| Unit tests | PASS420 /25files; all416 baseline cases retained |
| Oxlint / architecture graph/platform/shape | PASS223 source+E2E files |
| Architecture self-tests | PASS52 |
| Spacing / formatting | PASS15 fixtures; no unformatted files |
| Isolated Pages E2E | PASS10; includes100k-point selection/save/reload and worker failure/retry |
| Interactive smoke / accessibility | PASS desktop/narrow, native mouse, focus badge, labels and clean console; formal audit deferred per STACK |
| Native raster / performance | PASS672 exact,3pairs within budget, normal native app probe0LongTasks |
| Cache / history | PASS400/400 weakrefs released;66439bytes retained graph growth; undo/redo roundtrip |
| LSP | PASS216 source +7E2E files,0errors/warnings;6 informational source diagnostics |
| Independent review / Architect Review Notes | PASS;R1 resolved,0unresolved |
| Secrets / dependency audit | PASS0 /0 |
| Backend / migrations / containers | n/a |
| Release | Not requested; local ship only |
