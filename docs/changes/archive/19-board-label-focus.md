# CHANGE19 — Board label and rename focus

## Change Metadata

| Field | Value |
|---|---|
| Change |19|
| Slug |board-label-focus|
| Status |shipped locally|
| Branch |feature/19-board-label-focus|

## Goal

Fix the two owner-reported visual defects after Change18: the current board name has too
little visual weight in the dock, and the rename input's focus ring is clipped by the list.
Preserve SPEC5.17 behavior, dock dimensions, canvas and existing light visual identity.

## Design References

Owner screenshots of the dock and focused rename field (2026-11-13). Make the board name
the primary14px text with a secondary11px «Доски» label above it inside the existing40px
button. Keep the chevron and long-title ellipsis. Reserve scroll-container inset for focus.

## Backlog

### Frontend

- [x] F1 Improve board trigger hierarchy and safe truncation without changing reserved dock geometry — _Depends on:_ —
- [x] F2 Keep the rename input border and full focus outline inside its scrollable list at desktop/compact widths — _Depends on:_ —

### Other

- [x] T1 Add meaningful browser regression for rename focus clipping and title hierarchy; inspect desktop/compact Chrome states and run Fast Gate/LSP — _Depends on:_ F1,F2
- [x] T2 Full Gate, local ship/archive and cleanup; no public release — _Depends on:_ T1

## Files

board-library.tsx/module.css; e2e/pages/board-library-page.ts; e2e/editor-ux.spec.ts;
DESIGN.md and its sidecar only for the changed built typography. No engine, storage, schema,
clipboard, dependencies or hosting changes. Parent handles this bounded implementation.

## Contracts

SPEC5.17 and FRONTEND apply. Continue-mode plan; SPEC unchanged because this is a visual fix.
Implement via /work; automatic local /ship after checks is owner-authorized by AGENTS.md.

## Gate Checks

STACK commands apply. Native smoke uses own Pages preview4199, isolated from owner data;
E2E4185. Scope is chrome-only: verify focus/overflow, tool invariance and ordinary ink/pan;
no repeat of the unchanged engine's exhaustive raster/performance suite is needed.

## Verified Behavior

Focused browser tests PASS: dock geometry, sidebar/search/previews and the new rename/title
regression. The regression checks the actual focused outline against all four scroll-viewport
edges at1440×900,1000×720,390×844 and390×568; its outline must remain visible. It also checks
name/label hierarchy, long-title retention,40px button height, no horizontal scroll and unchanged
canvas bounds. Existing save/cancel/keyboard/board isolation scenarios remain in the full suite.

Native Windows Chrome Pages smoke: desktop/mobile captures in.impeccable/review/change-19,
full rounded input focus visible, correct title hierarchy/ellipsis, real ink/pan with zero
recorded Long Tasks and no console errors/warnings. A1px CDP screencast maintained background
frame cadence during automation; it is stopped during cleanup. Single layout detector run:[];
TypeScript LSP3files clean; Fast Gate lint, formatting, typecheck and focused E2E PASS.
Context7 quota was exhausted; official React/Playwright and MDN docs were consulted instead.

## Full Gate

PASS in a clean npm-ci snapshot: bootstrap, frontend/Pages builds, TypeScript,557 unit tests,
44 Chromium E2E scenarios, lint/architecture/static checks, formatting, secrets scan and
dependency audit. All7 production files match the native-tested Pages build; source parity
also passed. Smoke/keyboard/layout/performance evidence is recorded above. No backend or
migration command applies; formal accessibility scanning remains n/a per STACK.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

## Commit Message

```
fix(change-19): balance board title and preserve rename focus
```
