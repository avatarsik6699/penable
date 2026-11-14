# CHANGE25 — Tool selection and mathematical icon consistency

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `25` |
| Slug | `tool-visual-consistency` |
| Title | Tool selection and mathematical icon consistency |
| Status | `shipped locally` |
| Branch | `feature/25-tool-visual-consistency` |

## Goal

Owner feedback: remove the black selected-color ring and replace mathematical icons that diverge
from the editor style. Keep the compact Change24 composition and all tool behavior.

## Design References

DESIGN.md, existing Lucide icons; official Lucide MoveHorizontal/Move/Radius catalog.

## Backlog

### Frontend
- [x] F1 Replace selected-color ring with blue selection tile/check and use shared Lucide mathematical icons — _Depends on:_ —

### Other
- [x] T1 Verify palette selections/keyboard focus, all template choices, desktop/narrow appearance; LSP/Fast Gate then automatic local ship — _Depends on:_ F1

- [x] T2 Independent bounded source/visual review — _Depends on:_ T1

### Backend / Infra / Data
None

## Files

### Create / modify
- src/widgets/board-workspace/components/pen-toolbar/components/ink-palette/ink-palette.tsx and ink-palette.module.css
- src/widgets/board-workspace/components/pen-toolbar/components/template-panel/components/template-picker/components/template-icon/template-icon.tsx
- src/shared/ui/editor-icon/editor-icon.config.ts and editor-icon.types.ts
- docs/SPEC.md, DESIGN.md, .impeccable/design.json, docs/STACK.md and this change.

### Do NOT touch
- Board engine, geometry, state/persistence, dependencies, toolbar dimensions and release workflow.

## Contracts

See docs/SPEC.md§5.20 and docs/FRONTEND.md.

## Gate Checks

Standard STACK Fast/Full Gates. Owned native preview4205; automated E2E4185.
Palette selection keeps aria-pressed and distinct keyboard focus. Geometry and native rendering
unchanged, so retain existing raster/performance evidence. No new mirror-style unit tests.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Native screenshots used isolated ChromeDevTools after Playwriter capturetimeout; taskpage/
  session were closed. Owner notes/profile untouched. New behavioral unit tests are inapplicable
  to this narrow visual change; existing palette/template browser scenarios cover behavior.

## Delivery Evidence

Full Gate PASS2026-11-14: bootstrap, bothbuilds, types,646unit/76E2E tests, lint,
formatting, secrets and dependency audit. Fouraffected browsercases and4fileLSPdiagnostics
passed; native desktop/narrow screenshots and keyboardfocus inspected. Independent bounded
review PASS. Artifacts: .artifacts/change-25/acceptance.md and full-gate.json.
Localship only; no push/Pages deployment.

## Commit Message

```
fix(change-25): unify palette selection and mathematical icons
```
