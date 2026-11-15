# CHANGE 32 — Compact responsive toolbar

## Change Metadata

| Field | Value |
|---|---|
| Change | 32 |
| Slug | toolbar-responsive-layout |
| Status | `shipped locally` |
| Branch | feature/32-toolbar-responsive-layout |

## Goal

Fix the owner-reported intermediate window layout: width slider alone beneath an excessively
wide dock. Preserve the approved visual identity and phone/touch behavior. See SPEC5.21/5.24.

## Design References

Owner screenshot2026-11-15: installed Windows application, intermediate window width.

## Backlog

### Frontend
- [x] F1 Keep the fine-pointer dock in one compact row at900px and above; constrain/center its two-row fallback, preserve touch targets and phone layout; strengthen existing breakpoint regression — _Depends on:_ —

### Other
- [x] T1 Native visual/console checks, independent review and applicable Fast Gate — _Depends on:_ F1
- [x] T2 Full Gate and automatic local ship — _Depends on:_ T1

## Files

### Create / modify
- src/widgets/board-workspace/components/pen-toolbar/pen-toolbar.module.css
- e2e/pages/editor-chrome-page.ts
- docs/SPEC.md; docs/STACK.md; DESIGN.md

### Do NOT touch
- Toolbar actions/content, editor geometry/input/storage, PWA/update lifecycle, dependencies, publication.

## Contracts

See SPEC5.21/5.24 and FRONTEND. Changes remain CSS-only in production.

## Gate Checks

Existing STACK gates. Native owned Pages4210; never mutate owner5173/4208 data.
Fine-pointer widths900/1000/1199/1200/1254/1440 keep778×56 single row;899/768 two rows
capped at778px and centered;650/390/320 retain phone layout. Boundary widths899/900 and
650/651 plus coarse tablet/phone coverage; all controls reachable, invariant dock on tool
switch, no overlap/overflow and no canvas resize from tool switching. Existing engine evidence
reused because source/input/painting are unchanged. Required full E2E stays mandatory.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- The unchanged document-jobs metadata-assembly unit test aborted during the first Full Gate
  under concurrent build/lint load. The entire704-test suite passed again without source changes
  when run separately (and had passed the earlier Fast Gate). No assertion/timeout was changed;
  logs retain both attempts under.artifacts/change-32/.

## Commit Message

```
fix(change-32): keep intermediate toolbars compact
```

## Fast verification

PASS: lint/architecture/self-tests, formatting, typecheck,704 unit tests; changed TS LSP clean.
Expanded dock regression and4 Chromium/WebKit phone/tablet cases PASS. Playwriter native desktop
1254px/intermediate1000px/880px/phone390px screenshots inspected; no fresh console warnings/errors.
Exact899/900 and650/651 boundaries are asserted in isolated Chromium; native Windows viewport
rounding can differ by1px. Independent bounded source review: no findings. Native installed-window
launch is evidenced by owner screenshot; owner offline/physical tablet acceptance is not inferred.

## Full Gate — PASS

| Check | Result |
|---|---|
| Bootstrap | PASS; npm ci |
| Root/Pages production builds | PASS; existing advisory chunk-size warning |
| TypeScript / changed TS LSP | PASS; clean |
| Unit tests | PASS;704 on full rerun; initial unrelated abort recorded above |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;116 Chromium/WebKit scenarios |
| Secrets scan | PASS;no leaks |
| Dependency audit | PASS;0 vulnerabilities |
| Native smoke / accessibility | PASS; screenshots desktop/intermediate/phone, usable controls, clean console |
| Performance / raster | Unchanged-engine evidence reused; production CSS only |
| Architect notes / independent review | 0 unresolved; no findings |
| Backend / migrations / formal accessibility audit | n/a/deferred per STACK |
| Release / publication | Not requested |
