# CHANGE28 — Whole-figure preview by default

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `28` |
| Slug | `whole-template-preview` |
| Title | Whole-figure preview by default |
| Status | `ready for local ship` |
| Branch | `feature/28-whole-template-preview` |

## Goal

Owner requests the complete mathematical figure on initial preview instead of Closeup.
Keep explicit Closeup and ordinary preview pan/navigation. Baseline7eaf17a; no publication.

## Backlog

### Frontend
- [x] F1 Default preview camera to Whole; update existing unit/domain browser assertions and product docs — _Depends on:_ —

### Other
- [x] T1 Fast Gate/LSP, native visual smoke, Full Gate and automatic localship — _Depends on:_ F1

## Files

### Create / modify
- src/widgets/board-workspace/components/pen-toolbar/components/template-panel/components/template-preview/preview-camera{,.test}.ts.
- e2e/pages/math-templates-page.ts.
- docs/SPEC.md, README.md, DESIGN.md, .impeccable/design.json; STACKstatus onship.

### Do NOT touch
- Geometry/glyphs/renderer/input, persistence/versions, styles, dependencies/lockfile, owner data and publication.

## Contracts

SPEC5.22 and FRONTEND.md. Pure existing camera initialization only; no architectural change.

## Gate Checks

STACKFast/Full apply. Existing Chrome/WebKit math cases assert defaultWhole for all3mathkinds,
explicit Closeup, returnWhole, pointer/keyboard/touchpan and board isolation. Native owned preview4208;
ownerlocalhostdata untouched. Reuse Change27 ink/math raster/CPU evidence: relevant engine unchanged;
this change only alters the initial preview mode. No additional performance benchmark required.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

Context7 monthly quota unavailable; official Vitest/Playwright docs used as fallback.

## Commit Message

```
fix(change-28): show complete templates in the initial preview
```

Fast Gate: existing unit regression, typecheck, lint/architecture, formatter and all3changedTS LSP pass. Native isolated Chrome confirms defaultWhole+fullbounds for all3mathkinds and explicit Closeup. Console clean; screenshot .artifacts/change-28/whole-default.png. Playwriter first attempted; actiontimeout recoveredbyclosingownedpage/reset/deletingsession4; DevToolsfallback used.

## Full Gate — PASS

| Check | Result |
|-------|--------|
| Bootstrap | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| Types / changed-file LSP | PASS |
| Unit suite | PASS;704tests |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;110Chromium/WebKit cases |
| Secrets | PASS;no leaks |
| Dependency audit | PASS;0vulnerabilities |
| Native smoke / accessibility | PASS;3mathdefaultWhole/fullbounds;Closeupretained,cleanconsole,nativevisual |
| Performance / raster | Change27 unchanged-engine evidence reused; onlyinitialpreviewmodechanged |
| Architect review | 0unresolved |
| Backend / migrations / formal accessibility audit | n/a/deferred perSTACK |
| Release / Pages deploy | Notrequested |
