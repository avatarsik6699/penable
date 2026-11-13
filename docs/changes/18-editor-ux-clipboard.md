# CHANGE18 — Editor UX and unified clipboard

## Change Metadata

| Field | Value |
|---|---|
| Change |18|
| Slug |editor-ux-clipboard|
| Status |ready for local ship|
| Branch |feature/18-editor-ux-clipboard|

## Goal

Implement approved SPEC5.17: immediate discoverable image insertion, ordinary system clipboard
for board fragments/images, a polished left board sidebar and invariant dock geometry. Finish
automated/native acceptance and local ship, leaving owner manual acceptance. No transfer workflow.

## Design References

Preserve DESIGN.md light writing-first world, system typography and Lucide icons. Sidebar is a
left overlay, not canvas layout/recentering; preview/name rows expose overflow actions. Dock is
960px on wide desktop with reserved slots; two/three stable rows on narrower screens. Insertion
feedback is beside its trigger and does not shift content. User chose immediate centered insertion
and sidebar; superseded cross-board transfer picker/receipt/undo proposals are out of scope.

## Backlog

### Frontend

- [x] F1 Implement a strict portable fragment codec and one native clipboard owner for keyboard/menu copy/cut/paste, editable+PNG representations, heavy-job paths, external image precedence, direct PNG export and generation/permission/read-only/history safety — _Depends on:_ —
- [x] F2 Fix picker/blur cancellation lifecycle, unify file/drop/paste insertion, visible bounded placement, choosing/processing/success/error/retry feedback and atomic resource-safe commit; retain pointer cancellation — _Depends on:_ F1
- [x] F3 Replace library popover with styled left sidebar/search/create/context actions and bounded lazy preview service/render port; preserve catalog/storage and drain/cancel/readonly/failure semantics — _Depends on:_ —
- [x] F4 Reserve dock columns/rows and insertion context/status presentation so all tool/title/status changes leave its geometry and persistent controls stable; accessible responsive/short-height panels — _Depends on:_ F2,F3
- [x] F5 Architectural edge cases: one native paste path; exact captured-selection cut token after async write; fail closed when clipboard read permission hides custom-format provenance, and perform actual heavy fragment encode/decode in bounded workers — _Depends on:_ F1
- [x] F6 Prevent thumbnail loading/validation/first-paint from blocking writing: off-main document preparation and bounded offscreen raster jobs, with exact worker-safe raster owners/public worker API and negative architecture policy tests (DOM/React/other native source remain forbidden) — _Depends on:_ F3
- [x] F7 Independent review: fully decode/verify every embedded clipboard image before scene commit, not only PNG/JPEG headers; reject truncated/dimension-mismatched assets without scene/history/save changes and release temporary resources on failure/cancel — _Depends on:_ F1
- [x] F8 Independent review: carry advertised Penable paste-event formats through fallback routing; when async read is absent but own provenance is detectable, reject raster fallback instead of silently flattening — _Depends on:_ F1
- [x] F9 Independent review: an insertion resolving false must leave processing phase and show a clear retry/dismiss failure state, preserving the document/history — _Depends on:_ F2
- [x] F10 Browser regression: a rapid Ctrl+C then Ctrl+V currently drops paste while asynchronous copy is pending. Queue at most one paste intent behind copy/cut, read the fresh clipboard after successful write, and cancel it on stale/dispose/failure without repeating paste operations — _Depends on:_ F1
- [x] F11 Browser regression: clipboard processing/failure feedback must remain visible while Pen/Eraser is active; do not hide it in the conditionally mounted selection toolbar, and avoid duplicate persistent notices — _Depends on:_ F1,F4
- [x] F12 Native performance: first opening a 98-board sidebar caused a 58ms main task (56.7ms root click, 28.3ms forced layout). Remove unnecessary fixed-sidebar viewport measurement and reduce offscreen row layout cost without clipping menus or losing keyboard/search/visibility behavior; retain original cold/warm evidence — _Depends on:_ F3,F4

### Other

- [x] T1 Extend behavioral E2E fixtures/Page Objects for native clipboard paths/fallbacks/permissions, insertion focus/retry, library UX and fixed dock rectangles; preserve prior assertions with intentional menu updates — _Depends on:_ F4
- [x] T2 Exact platform ownership/public boundaries, Fast Gate/LSP, documentation and user instructions; independent source/security review and fix findings — _Depends on:_ F4
- [x] T3 Native Chrome functionality/performance/resource checks,672 raster cases/3 valid warmed pairs, bounded desktop/compact visual review and recorded limits — _Depends on:_ T1,T2
- [ ] T4 Full Gate, implementation commit, local merge/archive and cleanup; no push/deploy — _Depends on:_ T3

## Files

One implementation writer owns ALL src/ including colocated tests. Parent owns e2e/, docs/,
README/DESIGN/sidecar, scripts/architecture policy and shared gates/benchmarks/browser/Git.
Read-only reviewers never mutate. No new dependencies, hosting workflow or board schema changes.
Preserve recursive modules/types/utils/config/public boundaries; native capability owners exact.

## Contracts

SPEC5.17 governs details. Existing single-board undo/lease/migration/recovery contracts remain;
ordinary cut and paste are separate actions. Do not implement target-board picker, multi-record
transfer transaction, receipt, global undo, PWA, new fonts or text objects. Authorized continue-mode
SPEC refresh and /plan→/work→automatic local /ship, no extra confirmation required.

## Gate Checks

STACK commands apply. Baseline05828ec source/dist captured under.artifacts/change-18. Native
production preview4198 (strict) is owned test origin; never inspect/mutate localhost owner DB.
E2E4185/isolated contexts, benchmark4180/change18-baseline|candidate. Preserve524unit/31E2E
behaviors/672raster. Ordinary performance vs explicit decode/import is measured separately.
Follow Playwriter first and disclose true OS clipboard/picker/hardware limits. Retain original
failed evidence; final Full Gate production bytes must match native-tested dist.


## Acceptance Evidence

Full Gate PASS in a fresh npm-ci snapshot; all seven production files match the native-tested
Pages build. Source parity with that snapshot is recorded under.artifacts/change-18.

| Check | Result |
|---|---|
| Bootstrap, frontend and Pages builds, TypeScript | PASS |
| Unit tests |557/557 PASS across42 files|
| Lint, architecture policies/self-tests, formatting, static analysis | PASS |
| Chromium E2E, including native Clipboard API and responsive geometry |43/43 PASS|
| Secrets scan and dependency audit | PASS |
| TypeScript LSP |73 changed TS/TSX files clean; focused final reread clean|
| Native raster |672 comparisons, zero differences|
| Paired production-engine performance |First3 valid warmed pairs PASS; zero recorded Long Tasks|
| Native Windows Chrome smoke |Insertion success/error, real mouse ink/pan,98-board sidebar/previews/search and desktop/compact layouts PASS|
| Independent source/security review and focused fixes |No unresolved findings|
| Independent visual finish review |disposition: ship; no material fixes|
| Backend/migrations/formal accessibility scanner |n/a per STACK; keyboard/labels/responsive checks included above|

The original58ms cold sidebar task and three warm controls are retained alongside the fixed
cold measurement (zero tasks>=50ms). Visible previews were confirmed separately (six); the
original fixed-cold script used an incorrect aside selector for its preview counter. Baseline
work-p95 medians0.6/1.8/2.7/13.5ms versus candidate0.6/1.7/1.9/11ms passed the defined budget;
frame cadence and all raw measurements remain in ignored artifacts, not pen-latency claims.
Short-phone Playwright screenshot timed out; a Playwriter CDP capture and independent E2E
geometry cover the state, with physical screenshot scaling disclosed to the visual reviewer.

Remaining owner acceptance: physical Wacom, Windows file dialog and OS clipboard across apps
in the actual profile. Headless Chromium Clipboard API tests are not that hardware acceptance.
No push or Pages deployment is part of this local ship.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Chrome's native paste event may expose PNG while filtering a coexisting editable custom format. When async read is explicitly denied, provenance cannot be established without adding another public representation: show a permission error rather than silently flatten handwriting. Event-image fallback remains for an absent async API with no detectable own format. No text/HTML marker is added to the clipboard.

## Commit Message

```
feat(change-18): refine board library and image clipboard UX
```
