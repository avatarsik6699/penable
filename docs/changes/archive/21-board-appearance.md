# CHANGE21 — Distinct board covers

## Change Metadata

| Field | Value |
|---|---|
| Change |21|
| Status |shipped locally|
| Branch |feature/21-board-appearance|

## Goal

Implement the approved color+icon covers and manual customization plan. Replace sidebar
thumbnails with stable44px covers using8 colors/16 Lucide symbols, automatic unused pairs,
and a draft/save/cancel editor inside the same sidebar. Preserve the730px toolbar and canvas.

## Backlog

### Frontend

- [x] F1 Pure BoardAppearance contracts/assignment and library catalog2 codec; transactional first-writer migration preserving raw catalog in before-library-v2; readonly compatibility, fallback and write failures — _Depends on:_ —
- [x] F2 Appearance mutation through library/workspace ownership;44px cover and accessible sidebar editor with draft preview, save/cancel/focus/error semantics and responsive actions — _Depends on:_ F1
- [x] F3 Remove sidebar-only thumbnail loading/rendering/cache/visibility/job wiring, retaining PNG clipboard/export and minimap behavior; update exact architecture owners — _Depends on:_ F2

- [x] F4 Browser regression: preserve full rename input focus outline after row-height/panel decomposition changes, including390×568 scroll positioning; existing geometry assertions must remain unchanged — _Depends on:_ F2

- [x] F5 Browser regression: protected delete dialog must survive sidebar dismissal boundaries or prevent that dismissal, and always clear workspace modal ownership on cancel/confirm/dispose; current extraction can strand all tools disabled after deletion — _Depends on:_ F2

### Other

- [x] T1 Behavioral unit/E2E coverage for migration,100 distinct automatic covers, persistence/cancel/failure/readonly/keyboard and no thumbnail requests; preserve unrelated assertions and run Fast Gate/LSP — _Depends on:_ F1,F2,F3
- [x] T2 Native Chrome100-board responsiveness/desktop/compact review, independent source review and bounded design record/README updates — _Depends on:_ T1
- [x] T3 Full Gate, automatic local ship/archive and owned-environment cleanup; no public release — _Depends on:_ T2

## Files

Single source implementer owns ALL src/ (including colocated tests). Parent owns e2e/,
scripts/architecture/, docs/, README/DESIGN/sidecar, browser/environment/Git/shared gates.
Read-only reviewer never mutates. No dependencies, document/IDB schema, clipboard format,
toolbar dimensions, board undo, custom images/emojis or hosting changes.

## Contracts

Approved SPEC5.18 and FRONTEND. Continue-mode /plan → /work → automatic local /ship.
Colors: blue/teal/green/amber/orange/red/violet/pink. Icons: notebook/book/calculator/languages/
flask/atom/code/briefcase/lightbulb/music/palette/globe/calendar/folder/graduation/pen.
BoardAppearance={color,icon}; catalog2 entries={id,title,appearance}. Unknown appearance falls
back automatically without blocking writing. Existing JSON remains content-only.

## Gate Checks

STACK commands apply. Baseline4cfa96a; native Pages preview4201, E2E4185. Never access owner
localhost records. Screenshot batch covers desktop/mobile editor and lists. Measure100-board
cold/warm opening and ordinary input; assert library opening does not fetch board documents
or launch thumbnail workers. Shared PNG/raster behavior remains covered; no unnecessary engine
benchmark repeat if the painting algorithm is unchanged.

## Verified Behavior

Fast Gate:578 unit tests across43files, lint/architecture self-tests, formatting, strict types
and LSP49 changed TS/TSX files (no errors/warnings;4existing async-conversion suggestions).
Independent source review found no unresolved issues, including focused F5 rereview. Native
visual finish disposition:ship, no material fixes. Eight cover contrasts measured5.30–6.52.
Single detector run had18advisories for new palette/type roles, now documented; no blocking rule.

Native Windows Chrome on owned4201:100-board cold and2warm opens/search, zero board-content
IDB get/getKey calls, zero thumbnail resources, zero >=50ms LongTasks, two canvas layers and
clean console on final build. Initial measurement retained (one52.8ms animation frame with
36.7ms click script, no LongTask); two earlier404s originated from the outside-base seed probe,
while final app resource statuses and fresh console are clean. A1px CDP capture maintained
background cadence and is stopped at cleanup. Screenshots include list/editor/compact actions.

Initial E2E16/20: two invalid parent fixtures lacked required document4 view fields (fixed),
F4 focus-scroll regression (fixed without changing assertions), and an old hashed-worker404
from a parent build overlapping the running test (orchestration corrected). Next full run49/51
exposed F5 protected-delete ownership; after fix all3 targeted Cancel/Confirm/Escape/backdrop
and cross-board deletion cases pass. Failures/traces retained under.artifacts/change-21.
Full Gate below reruns the entire final52-case suite without overlapping builds.

## Full Gate

PASS in a clean npm-ci snapshot: bootstrap, frontend/Pages builds, strict TypeScript,
578 unit tests across43files,52 Chromium E2E scenarios, lint/architecture/self-tests,
formatting/static checks, secrets scan and dependency audit. All6 production files match
the native-tested Pages build, and gated source parity passes. Source/visual review and
native keyboard/layout/performance evidence above have no unresolved acceptance failures.
Backend/migration CLI and formal accessibility scanner remain n/a per STACK; catalog
migration/rollback is exercised by unit and real IndexedDB browser tests.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

## Commit Message

```
feat(change-21): add recognizable customizable board covers
```
