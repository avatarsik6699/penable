# CHANGE17 — Transformable content, images and board library

## Change Metadata

| Field | Value |
|---|---|
| Change |17|
| Slug |board-editing-library|
| Status |active|
| Branch |feature/17-board-editing-library|

## Goal

Deliver all owner-requested capabilities as one integrated local release: resize/rotate selection,
insert/crop PNG/JPEG and organize independent named boards. Complete automated/native acceptance,
reviews and local ship; only owner manual/hardware acceptance remains. No PWA or deploy.

## Design References

Preserve approved Change16 light floating editor / DESIGN.md. Extend central dock with current-board
chooser and image insert; navigation/help stay below. Eight resize handles plus rotation handle are
functional canvas affordances; numeric transform controls provide keyboard access. Board list is a
nonmodal dock popover, delete is a protected confirmation. Desktop1440/1280 and390px remain usable.

## Backlog

### Frontend / data

- [x] F1 Generalize ordered scene/history/regions/renderer to typed ink/image items and immutable affine sources; strict schema4/legacy decode, embedded deduplicated assets, raw upgrade backup, bounded geometry/asset worker protocol and unchanged ink fast paths — _Depends on:_ —
- [x] F2 Resize/rotate handles, transient previews, fixed anchors/Shift, numeric keyboard controls, cancellation/undo/redo and transformed clipping/eraser/PNG/minimap — _Depends on:_ F1
- [x] F3 Safe PNG/JPEG file/drop/paste decode and selected insertion; native bitmap owner, mixed copy/edit/crop/PNG, cross-board asset-safe clipboard and limits/error/lifecycle coverage — _Depends on:_ F1,F2
- [x] F4 Feature-owned origin lease/catalog and board-scoped repositories/workers/sessions; atomic legacy bootstrap, independent backups, flush-or-fail switch, create/rename/confirmed delete and recovery/race tests — _Depends on:_ F1
- [x] F5 Integrate image controls, transform actions and board chooser/current title in central dock; preserve style, focus, one-panel ownership, busy/read-only/error handling and responsive layout — _Depends on:_ F2,F3,F4

- [x] F6 Harden upper-limit asset validation and native decode/import failure cleanup: no regex stack overflow for valid8MiB sources, corrupt image JSON must not replace current content, close decoded resources on every rejection/cancel — _Depends on:_ F3

- [x] F7 Fix discovered edge cases: off-center resize contact with no displacement must preserve exact scene/redo; never group lineage fragments across intervening images and change paint order — _Depends on:_ F1,F2

- [x] F8 On library startup, a catalog pointing to a missing/corrupt board must show recovery error instead of treating it as a new empty document; preserve useful raw recovery for catalog and selected record — _Depends on:_ F4

- [x] F9 Independent review: release canceled decode resources without touching reused/newer assets; preserve partial ink membership after image crop; ordered mixed-content previews must not lift lower items over later images; ignore disposed generation notices — _Depends on:_ F1,F2,F3
- [x] F10 Invalid-image JSON preflight must leave current saved document and save phase intact after cancel; errors belong to import feedback, not a false persistent save failure — _Depends on:_ F3
- [x] F11 Fresh visual finish: bound library/selection panels by their actual viewport position; align compound board buttons horizontally; make compact dock row placement deliberate with 40px targets and no isolated status row — _Depends on:_ F5

### Other

- [x] T1 Extend E2E domain fixtures/Page Objects with transformations, image file/drop/paste/crop/PNG, catalog/switch/migration/backups/failure/read-only and data-preservation regressions — _Depends on:_ F5
- [x] T2 Apply exact capability owners/public API/performance harness compatibility and required Fast Gate/LSP diagnostics; update binding docs and user instructions — _Depends on:_ F5
- [x] T3 Native runtime functional/performance/raster/large-image lifecycle checks, bounded desktop+compact visual finish and independent source/security review — _Depends on:_ T1,T2
- [ ] T4 Full Gate, local commit/merge/archive and handoff of concise manual scenarios; no push/deploy — _Depends on:_ T3

## Files

One implementation writer owns ALL src/ including colocated tests and actual recursive submodules.
Parent owns docs/, e2e/, scripts/architecture exact capability registry, scripts/performance compatible
harness, package lifecycle, shared checks, browser sessions, Git and cleanup. No new dependencies.

Create/modify src/entities/board transforms/items/regions/selection/history/snapshots and APIs;
src/features/board-document codec/image-assets/library/session/jobs/adapters/components and APIs;
src/widgets/board-workspace model/dock/selection/native bindings/rendering/images and APIs;
src/shared/ui/editor-icon static library mapping where needed. Preserve fractal folder/type conventions.

Do not touch user notes/origin DB, unrelated projects, historical approved mock, hosting workflows,
backend/auth/PWA, font/style identity, package dependencies or generic platform exemptions.

## Contracts

See SPEC5.16, existing FRONTEND and STACK. Architect recommendations are implementation guidance;
owner has explicitly authorized these three capabilities and uninterrupted implementation. Do not
stop for a separate SPEC confirmation. Routine product defaults are recorded in SPEC5.16.

## Gate Checks

Existing Fast/Full rows apply. Baseline is67f4d86, source/artifact snapshots under.artifacts/change-17.
Use isolated native Pages preview4197 (strict), benchmark4180, E2E4185 with own contexts. Never use
localhost:5173/user profile data for tests. Keep448unit/15E2E behavior and672raster baseline; add
meaningful boundary tests and first3 fully warmed before/after pairs, preserving failed evidence.
Measure ordinary interactions separately from explicit decode/import/initialization. Native OS
clipboard/physical pen claims require owner acceptance; portable image/event paths can be tested.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Runtime keeps the existing `strokes` collection name for native API compatibility, but its members are discriminated BoardItem values; schema4 serializes only `items` and `assets`. Images never masquerade as synthetic point strokes.
- The library deliberately retains the legacy origin lease name so older open tabs cannot acquire a competing writer during catalog migration. The original main key and older recovery copies remain intact; new board repositories scope their records and backups.
- Geometry workers receive image placement metadata without binary bytes. Native decoded resources use operation claims plus scene ownership, so cancellation cannot leak a late bitmap or close an asset reused by the canonical scene.
- Native large-image redo initially exposed a453ms main-thread base64 conversion. Strict native Uint8Array decoding (with validated fallback) removed that measured long task; ordinary editing, explicit file transfer/decode and initial document load are measured separately.
- First3 valid fully warmed native A/B pairs passed all CPU p95 budgets: ink10k0.5→0.5ms, ink50k1.5→1.4ms, sparse navigation2.7→1.5ms, dense navigation10.2→7.9ms, with0 measured LongTasks. The1px acknowledged screencast was identical for both builds. Frame intervals still had isolated stalls (baseline449.7ms, candidate166.3ms); these measurements do not establish compositor or physical pen latency. Full original samples are retained.

## Commit Message

```
feat(change-17): add content transforms, images and board library
```

## Verification evidence

| Check | Result |
|---|---|
| Unit / typecheck |524 tests /37files PASS; strict tsc PASS |
| Browser regression |31 E2E PASS, including legacy migration/raw recovery, affine history, image bytes/crop/PNG, separate boards and failure paths; compact panel regression is red before F11 and green after |
| LSP |142 changed TypeScript files checked;0 errors/warnings,6 informational async-conversion suggestions |
| Native Chrome | Final Pages artifact index-hbR8Av0M.js;1440×900,1280×720,390×844 (up to1px native rounding); actual pointer resize, board CRUD/resource release and final panel reachability PASS |
| Large image |4,721,114-byte PNG; ordinary move/resize/ink/pan/overview/delete/undo/redo without observed >=50ms main-thread tasks; final board switch closes every unreferenced bitmap |
| Native raster / performance |672 exact raster comparisons; first3 fully warmed pairs PASS budgets. Final benchmark engine/index/worker bytes unchanged after F11 UI fix; original noisy frame timing samples retained |
| Independent source/security | F9 findings fixed and re-reviewed; final F11 measurement/cleanup/input review has no P1/P2 findings |
| Visual finish | disposition ship; all3 original material fixes resolved in one batch/confirmation, no remaining material findings. Detector's18px modal heading advisory is an intentional dialog role |
| Hardware / OS clipboard | Physical Wacom feel and actual Windows clipboard/file-save dialogs remain owner manual acceptance; synthetic image clipboard/drop and internal clipboard are covered |

Evidence is ignored under.artifacts/change-17. Tests use owned origins/contexts; the owner's
localhost:5173 notes were never inspected or modified through the browser. No release requested.

## Full Gate result

| Check | Result |
|---|---|
| Clean bootstrap / npm ci | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| TypeScript / tsc | PASS |
| Unit suite /524 | PASS |
| Lint / architecture / spacing / SAST | PASS |
| Formatting | PASS |
| E2E /31 | PASS |
| Secrets scan | PASS — no leaks |
| Dependency audit | PASS —0 vulnerabilities |
| Migration | Browser legacy1/2/3→4/catalog and exact raw recovery PASS; no CLI migration |
| Backend | n/a — browser-only app |
| Native smoke / accessibility | PASS scoped labels, pointer, keyboard, focus, panel scroll and responsive checks; formal automated accessibility audit deferred in STACK |
| Raster / performance | PASS scoped evidence above |
| Architect Review Notes |0 unresolved |
| Production bytes |4/4 exact against tested Pages artifact |
| Release / push / deploy | Not requested; local ship only |

Fresh isolated npm-ci snapshot: /tmp/penable-change17-gate-rz6nxyot (removed after verification).
Detailed results and original failed probes remain under.artifacts/change-17.
