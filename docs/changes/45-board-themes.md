# CHANGE 45 — Light and dark board themes

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `45` |
| Slug | `board-themes` |
| Title | Light and dark board themes |
| Status | `active` |
| Branch | `feature/45-board-themes` |

## Goal

Implement the owner-approved application-wide Light / Dark / System preference and adaptive
vector ink. Preserve stored content and light PNG exports while making the board and existing
compact interface comfortable in either theme. Light stays the default.

## Backlog

### Frontend
- [x] `F1` Implement preference lifecycle/settings/localization, pure palette resolution, all native/SVG previews and theme tokens; preserve active input, selection/history, data and light PNG; add focused behavioral unit tests. — _Depends on:_ —
- [x] `F2` Fix the independent review finding: ensure Retry save retains readable primary colors on hover in both themes; assert computed contrast in the save-error browser scenario. — _Depends on:_ F1

### Infrastructure
- [x] `I1` Add exact platform policy coverage, isolated theme browser regressions and native large-board/raster/export evidence; update user/design/tooling documentation. — _Depends on:_ F1, F2

### Other
- [x] `T1` Verify Fast Gate, required LSP/Playwriter and bounded craft review, independent review and automatic local ship through Full Gate. — _Depends on:_ F1, I1

## Files

### Create / modify
- `src/app/`, `src/main.tsx`, `src/shared/lib/theme/`, `src/shared/lib/messages/` and `src/shared/lib/i18n/` — preference, settings, palette, localization and tests.
- `src/widgets/board-workspace/` and `src/features/board-document/components/storage-panel/` — explicit composition, display/previews/minimap/raster export, tokens and tests.
- `scripts/architecture/`, `scripts/performance/`, `e2e/` — exact native capabilities, owned native evidence, fixtures/Page Objects and domain specs.
- `docs/SPEC.md`, `docs/FRONTEND.md`, `docs/STACK.md`, `docs/GUIDE.md`, `DESIGN.md` and `README.md` — approved contract and available behavior.
- `docs/performance/45-board-themes.md` — native exact-raster, paired CPU and browser evidence with explicit measurement limits.

### Do NOT touch
- Document/catalog/IDB schemas, raw points, accepted geometry/input algorithms, image assets, dependencies, historical archives or unrelated rendering architecture.
- Personal browser data, existing owner boards, Git remotes or public deployment.

## Contracts

See SPEC §5.28, FRONTEND Theme preference and display colors, and the Files list above.

## Gate Checks

Standard STACK Fast/Full gates remain mandatory. Task-owned native Pages preview uses unused
loopback47451 (4221/4222 already contained storage), dev47452, benchmark4180 and automated E2E4185;
use owned data only. Compare exact light raster
and PNG across themes; verify complete and active layers, all palette/instruments/templates,
unchanged images and document/history/selection. Record native large-board repaint/ordinary input
evidence separately from physical tablet/GPU acceptance. Source writer owns src only; parent owns
policy/E2E/docs/native evidence/shared gates/Git. Independent read-only review precedes local ship.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Context7 returned its quota error; official React, i18next and Playwright documentation was used
  as the documented fallback. TypeScript LSP stalled on both directory and single-file diagnostics;
  tsc and architecture checks remain separate successful evidence, not a claim of LSP completion.
- Playwriter exercised ordinary Windows Chrome but screenshot capture timed out; the supported
  Chrome DevTools fallback supplied desktop and390px visual evidence in an isolated context.
  Native RAF throttling required the existing benchmark task scheduler; timings describe CPU work,
  not frame latency or physical tablet/GPU acceptance. See the native evidence record.

## Commit Message

```
feat(change-45): add adaptive light and dark board themes
```
