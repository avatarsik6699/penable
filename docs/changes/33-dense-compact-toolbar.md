# CHANGE 33 — Dense compact toolbar composition

## Change Metadata

| Field | Value |
|---|---|
| Change | 33 |
| Slug | dense-compact-toolbar |
| Status | active |
| Branch | feature/33-dense-compact-toolbar |

## Goal

Replace the owner-rejected stretched two/three-row toolbar with genuinely compact, dense groups.
The two annotated screenshots show excess blank space around thickness and the board chooser.
Preserve current visual identity, all commands, coarse targets and stable geometry on tool switch.

## Backlog

### Frontend
- [x] F1 Separate history into a dock layout item; compose compact rows with bounded chooser, full useful context width and no isolated thickness row — _Depends on:_ —
- [x] F2 Assert density, group placement, no overlap and stable bounds across pointer types, breakpoints and all tools — _Depends on:_ F1

### Other
- [x] T1 Native batched screenshots/console/keyboard, independent review and Fast Gate — _Depends on:_ F2
- [x] T2 Full Gate and automatic local ship — _Depends on:_ T1

## Files

### Create / modify
- src/widgets/board-workspace/components/pen-toolbar/pen-toolbar.tsx and pen-toolbar.module.css
- src/widgets/board-workspace/components/pen-toolbar/components/ink-settings/ink-settings.module.css
- src/widgets/board-workspace/components/selection-toolbar/selection-toolbar.module.css
- e2e/pages/editor-chrome-page.ts; e2e/pages/touch-layout-page.ts; e2e/pages/native-touch-page.ts
- docs/SPEC.md; docs/STACK.md; DESIGN.md

### Do NOT touch
- Drawing/input/geometry/storage, PWA lifecycle, dependencies, publication.

## Contracts

See SPEC5.25, FRONTEND and Files above. Existing commands/state and native keyboard behavior remain.

## Gate Checks

STACK Fast/Full unchanged. Owned native Pages4212; never mutate owner5173/4208/4210 data.
All controls remain reachable and bounded at320..1440. Test exact407/423/802/838 boundaries,
medium screenshot sizes (~600/830CSSpx), long board labels, all tools and coarse44px targets.
Every compact row has useful neighboring groups; no full-width chooser or lone thickness row.
Production composition/CSS only: reuse unchanged engine/raster evidence. No physical hardware claims.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Query frame deliberately fills the viewport: a short size-container strip would change the
  containing block of existing fixed sheets. Only its padded content width drives toolbar modes.
- Native screenshot persistence via DevTools Linux filePath was rejected by its Windows workspace
  path validation. Screenshots were returned inline; no permission/profile change was attempted.

## Commit Message

```
fix(change-33): compose dense compact toolbar rows
```

## Fast verification and review

PASS: lint/architecture, formatting, typecheck; changed TS files have no LSP diagnostics. No new
unit logic; Full Gate retains whole unit suite. Focused density/touch matrix reported6 passes;
final focused rerun (long title, all fine modes,320/423/838 insets, Chromium/WebKit keyboard
sheets) exits0 with4 passes. No assertion/timeouts weakened. Source review confirms numeric
budgets, container-safe layout and fixed-overlay ownership; no remaining blockers.

Native Playwriter verifies new query frame, keyboard thickness3.0→3.1 and clean console. Native
screenshots use isolated Chrome DevTools after two Playwriter screenshot timeouts. Inspected
dense medium and emulated390px coarse composition, with no console errors/warnings. Exact
viewport transitions are automated; Windows browser zoom can alter raw CDP requested dimensions.
No owner acceptance or physical touch/pen performance inferred. Design detector initial pass: [].

## Full Gate — PASS

| Check | Result |
|---|---|
| Bootstrap | PASS; npm ci |
| Root / Pages builds | PASS; existing advisory chunk-size warning |
| Typecheck / changed TS LSP | PASS; no diagnostics |
| Unit tests | PASS;704 |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;116 Chromium/WebKit cases (4.4m) |
| Secrets | PASS;no leaks |
| Dependencies | PASS;0 vulnerabilities |
| Native smoke / a11y | PASS; keyboard width adjustment, DOM composition, inline medium/phone screenshots, clean console |
| Performance / raster | Existing unchanged-engine evidence reused; no per-sample/runtime input changes |
| Architect notes / review | 0 unresolved; bounded design/source review has no remaining blockers |
| Backend / migrations / formal a11y audit | n/a/deferred per STACK |
| Physical hardware / owner acceptance | Not inferred from automation |
| Release / public deployment | Not requested |
