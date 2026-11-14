# CHANGE24 — Compact writing and template controls

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `24` |
| Slug | `compact-tool-panels` |
| Title | Compact writing and template controls |
| Status | `shipped locally` |
| Branch | `feature/24-compact-tool-panels` |

## Goal

Replace tall tool forms with compact icon controls and readable mathematical auto steps.
Preserve existing writing, vector geometry and document compatibility. See SPEC§5.20.

## Design References

Current DESIGN.md and production toolbar; approved chat plan2026-11-14.

## Backlog

### Backend
None

### Frontend
- [x] F1 Compact icon-based writing/template panels, dense dimensional palette, accessible tool/help hints, outline slider and visual sizing — _Depends on:_ —
- [x] F2 Pure bounded auto-step policy and resilient panel drafts/last-valid previews/manual recommendations, unchanged durable config — _Depends on:_ F1

### Infra / Data
None

### Other
- [x] T1 Behavioral unit/E2E coverage, native desktop/narrow/short visual and performance acceptance, LSP/Fast Gate — _Depends on:_ F1, F2
- [x] T2 Independent source/UX/security review and resolve findings before Full Gate/local ship — _Depends on:_ T1

## Files

### Create / modify
- src/entities/board/templates/: pure recommendation helper and tests/public API.
- src/widgets/board-workspace/components/pen-toolbar/: decomposed panel components/hooks/styles/tests.
- src/shared/ui/: icon mappings and scoped reusable hint controls as needed.
- e2e/: affected domain Page Objects/specs/fixtures.
- docs/SPEC.md, docs/STACK.md, DESIGN.md, .impeccable/design.json and this change.

### Do NOT touch
- Writing geometry/native ink renderer, schema/versioned template layout behavior, dependencies, lockfile, release workflows.
- User-owned browser notes/storage and live Pages.

## Contracts

See docs/SPEC.md§5.20,§5.19 and docs/FRONTEND.md.

## Gate Checks

Standard STACK Fast/Full Gates apply. Native owned Pages preview4204; automated E2E4185.
Check1280×720,1440×900,390×844 and short viewport, all template variants including fill/
manual errors. Observe Long Tasks for repeated math range edits; no attributable ordinary≥50ms
tasks. Existing native ink code/layout remain unchanged, so accepted raster evidence is retained.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Native UI evidence uses Playwriter desktop and an isolated ChromeDevTools narrow capture after
  Playwriter screenshot timeout. Hardware Wacom feel remains owner acceptance; ink geometry is unchanged.

## Delivery Evidence

Full Gate PASS2026-11-14: npm ci, build, build:pages, typecheck,646unit tests, lint,
format:check,76E2E tests, secrets scan and dependency audit. Independent source/UX/security/
visual review PASS. Native16range edits produced no>=50ms LongTasks; no paint/hardware latency
claim. Detailed ignored artifacts: .artifacts/change-24/acceptance.md and full-gate.json.
Local ship only; no push/Pages deployment.

## Commit Message

```
feat(change-24): compact tool panels and automatic axis steps
```
