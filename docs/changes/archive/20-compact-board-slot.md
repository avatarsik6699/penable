# CHANGE20 — Compact board slot

## Change Metadata

| Field | Value |
|---|---|
| Change |20|
| Status |shipped locally|
| Branch |feature/20-compact-board-slot|

## Goal

Reduce the current-board slot and contextual-settings allocation on wide desktop so unused
space is removed from the dock. Preserve its
fixed dimensions across tools/titles, typography, accessible names, long-title tooltip,
phone/tablet layouts, sidebar and rename focus treatment.

## Backlog

- [x] F1 Compact desktop dock and align insertion feedback with its moved image trigger; refresh the exact width in SPEC/DESIGN — _Depends on:_ —
- [x] F2 Owner screenshot follow-up: remove remaining blank space in both board and contextual-settings columns. Use 128px board and 190px context slots inside a 730px desktop dock, keeping fixed geometry across all tools — _Depends on:_ F1
- [x] T1 Update existing invariant geometry acceptance, run scoped Fast Gate/LSP and desktop/mobile native visual smoke — _Depends on:_ F1,F2
- [x] T2 Full Gate and automatic local ship/archive; no release — _Depends on:_ T1

## Files

pen-toolbar.module.css; e2e/pages/editor-chrome-page.ts; SPEC desktop width, DESIGN.md/sidecar.
No data, engine, dependencies or input changes. Parent handles this small sequential fix.

## Contracts

SPEC5.17; user request authorizes refining its desktop dock allocation. Fixed desktop width
is 730px,56px high; board slot 128px and context 190px. Existing widths<=1199px remain unchanged.
Use /plan continue → /work → owner-authorized local /ship.

## Gate Checks

STACK commands apply. Native Pages preview4200, E2E4185, never owner localhost data. No
repeat of unaffected exhaustive engine raster/benchmarks for this CSS-only source change.

## Verified Behavior

Fast Gate lint/architecture/formatting, Pages build/typecheck, focused3E2E and LSP for the
changed Page Object PASS. Native Windows Chrome observed identical730×56dock and128×40board
bounds across Pen/Eraser/Selection; insertion notice and image-trigger x coordinates match
within0.03px. Short «Eng» and long names, image insertion and mobile layout were captured in
.impeccable/review/change-20. Console clean. Single layout detector run:[]; scoped visual review
found no material defects. Background1px screencast was used for capture cadence and stopped.
Context7 remains quota-limited; existing official Playwright documentation applies to the
unchanged boundingBox/assertion API. The extra per-sample engine/raster suite is inapplicable.

## Full Gate

PASS in a clean npm-ci snapshot: bootstrap, frontend/Pages builds, TypeScript,557 unit tests,
44 Chromium E2E scenarios, lint/architecture/static checks, formatting, secrets scan and
dependency audit. All7 production files match the native-tested Pages build; source parity
also passed. Smoke/keyboard/layout evidence is recorded above. The native engine source is unchanged;
no repeated engine benchmark applies to this bounded CSS change. No backend or
migration command applies; formal accessibility scanning remains n/a per STACK.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

## Commit Message

```
fix(change-20): compact the desktop board title slot
```
