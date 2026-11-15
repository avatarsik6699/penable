# CHANGE 34 — Stable pen-lift cursor and calm writing controls

## Change Metadata

| Field | Value |
|---|---|
| Change | 34 |
| Slug | calm-writing-feedback |
| Status | shipped locally |
| Branch | feature/34-calm-writing-feedback |

## Goal

Address the owner's Wacom pen-lift cursor jump and distracting toolbar disable/re-enable flash
on each stroke. Preserve input geometry and every existing command/storage safety guard.

## Backlog

### Frontend
- [x] F1 Retain the last trusted cursor presentation at pen release (up and active-contact buttons-loss); preserve normal next hover, mouse release and cancellation; add focused event-order regressions — _Depends on:_ —
- [x] F2 Provide stable visual presentation for transiently disabled toolbar controls while preserving native disabled behavior, intrinsic unavailable states and persistence feedback — _Depends on:_ —
- [x] F3 Add browser regressions for pen lift coordinates, repeated writing color/geometry stability, blocked actions and recovery — _Depends on:_ F1, F2
- [x] F4 Recognize formatter-parenthesized JSX in the existing thin-forwarder architecture exception; add a positive regression, preserving all other restrictions — _Depends on:_ F2

### Other
- [x] T1 Required native checks, LSP/Fast Gate and independent review — _Depends on:_ F3
- [x] T2 Full Gate and immediate local ship — _Depends on:_ T1

## Files

### Create / modify
- src/widgets/board-workspace/components/writing-surface/native/bindings/pointer-binding.ts and pointer-binding.test.ts
- src/shared/ui/button/button.tsx; button.types.ts; button.module.css
- src/widgets/board-workspace/board-workspace.tsx
- src/features/board-document/components/board-library/board-library.tsx and board-library.types.ts
- src/widgets/board-workspace/components/pen-toolbar/pen-toolbar.tsx
- src/widgets/board-workspace/components/pen-toolbar/components/tool-controls/tool-controls.tsx
- src/widgets/board-workspace/components/pen-toolbar/components/history-controls/history-controls.tsx
- e2e/pages/writing-feedback-page.ts; e2e/fixtures.ts; e2e/writing-feedback.spec.ts
- docs/SPEC.md; docs/STACK.md; DESIGN.md
- scripts/architecture/shape.mjs; scripts/architecture/check.test.mjs

### Do NOT touch
- Raw point capture/ink geometry, renderer/pressure algorithms, persistent schemas, existing notes,
  dependency versions, PWA behavior and publication.

## Contracts

See SPEC5.26, FRONTEND and Files. Preserve storage/command authority; ordinary autosave remains
serialized and revision-aware. This is a feedback change, not a new global autosave lock.

## Gate Checks

STACK Fast/Full; native owned Pages4214. Never mutate owner5173 or existing preview notes.
Cursor unit tests assert terminal event does not move marker but original event still reaches
ink handling; genuine subsequent hover and mouse release work. Browser sequence can give pen up
raw coordinates differing from coalesced geometry to isolate the presentation defect. Synthetic
regression is not proof of Wacom driver behavior. No arbitrary distance/time filtering.
Transient UI: compare computed colors/opacity/background and dock bounds before/during/after
repeated strokes; native disabled blocks mouse/keyboard actions, readonly/no-history stay muted.
Verify normal commit/save/reload and no handler bypass. Native screenshot/console when available.
Existing engine/raster evidence applies: no geometry/painter/per-sample data change.

## Architect Review Notes

- [x] No architect review issues recorded

## Full Gate

| Check | Result |
|---|---|
| Bootstrap | PASS — npm ci |
| Migrations / backend | n/a — browser-only application, no schema change |
| Root and Pages builds | PASS — both production bases; existing >500kB advisory only |
| Unit suite | PASS — 707 tests / 61 files |
| Lint / architecture / SAST | PASS — repository lint and checker self-tests |
| Formatting / TypeScript | PASS — format:check and tsc |
| Browser suite | PASS — 119 tests, Chromium and touch WebKit, 4.7m |
| Native smoke / accessibility | PASS — owned Windows Chrome4214; mouse drawing, native lock/color parity, desktop/narrow screenshots, no page errors; existing labels/keyboard retained |
| Secrets | PASS — gitleaks, no leaks |
| Dependencies | PASS — npm audit, zero vulnerabilities |
| Performance | Existing engine/raster evidence applies; no geometry/painter/per-sample data changes, only cursor event gating; actual pen latency unverified |
| Architect / independent review | PASS — zero unresolved findings |
| Hardware acceptance | Unverified — owner Wacom One pen-lift reproduction and physical handwriting feel |
| LSP | Initial Button file diagnostics clean; subsequent requests unresponsive, tsc clean independently |

No release requested; local delivery only. Logs/screenshots: ignored .artifacts/change-34/.

## Implementation Notes

- Physical Wacom driver behavior remains unverified. Terminal-event regression is synthetic; raw ink capture is unchanged.
- Context7 quota was exhausted; official React, Pointer Events and Vitest documentation supplied the fallback.
- Fast Gate passed lint/format/types and 3 focused unit + 3 browser regressions. Native Windows Chrome Pages4214 mouse lock/colors, desktop/narrow screenshots and clean page errors verified.
- Independent reviewer found two CSS parity gaps; both fixed and follow-up review has no unresolved findings.
- LSP Button diagnostics initially returned zero; subsequent directory/file requests and workspace refresh stopped responding. Required requests were attempted; tsc independently passed.

## Commit Message

```
fix(change-34): stabilize pen lift and calm writing feedback
```
