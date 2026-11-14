# CHANGE29 — Full-width shape preview

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `29` |
| Slug | `full-width-shape-preview` |
| Status | `shipped locally` |
| Branch | `feature/29-full-width-shape-preview` |

## Goal

Fill the available panel width with nonmathematical shape previews instead of leaving an
unused strip to the right. Keep uniform figure proportions. Owner-authorized small CSS fix.

## Backlog

### Frontend
- [x] F1 Fill preview wrapper width; native desktop/narrow sizing and visual verification — _Depends on:_ —

### Other
- [x] T1 Applicable Fast/Full gates and automatic localship — _Depends on:_ F1

## Files

### Create / modify
- src/widgets/board-workspace/components/pen-toolbar/components/template-panel/template-panel.module.css.
- DESIGN.md; docs/STACK.md status onship.

### Do NOT touch
- Figure geometry/versions, renderer, camera behavior, data, dependencies, UI controls or publication.

## Contracts

FRONTEND.md, existing SPEC5.20/5.22 panel and aspect-ratio contracts. CSS wrapper sizing only.

## Gate Checks

Use STACKFast/Full. Native ownedPages4209, before/after computed bounds and final screenshot,
normal shapes atdesktop/phone and mathematical grid sanity. No new tests for this low-impact
CSS correction; existing responsive/browser coverage applies. Reuse Change27 engine CPU/raster
as unchanged, no new LSP requirement for CSS-only source. Localshiponly.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Commit Message

```
fix(change-29): fill available width with shape previews
```

Fast verification: lint/architecture and formatterPASS; noTS/sourceunit changes. Native beforepreview149px/available332; after331.994/332 onall5ordinaryshapes. Phone390pxordinary/mathpreview338/338,zerooverflow,cleanconsole. Screenshot .artifacts/change-29/full-width.png. Detector runonce; no new designfinding.

## Full Gate — PASS

| Check | Result |
|-------|--------|
| Bootstrap | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| TypeScript | PASS;LSP n/a, no TS edits |
| Unit suite | PASS;704tests |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;110Chromium/WebKit cases |
| Secrets | PASS;no leaks |
| Dependency audit | PASS;0vulnerabilities |
| Native smoke / accessibility | PASS;all5shapes fill332px;phone338px,zerooverflow,cleanconsole;geometry/controls unchanged |
| Performance / raster | Unchanged-engine Change27 evidence reused;CSSwidthonly |
| Architect notes | 0unresolved |
| Backend / migrations / formal accessibility audit | n/a/deferred perSTACK |
| Release / Pages deploy | Notrequested |
