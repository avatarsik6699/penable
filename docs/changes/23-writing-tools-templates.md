# CHANGE 23 — Writing instruments and vector templates

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `23` |
| Slug | `writing-tools-templates` |
| Title | Writing instruments and vector templates |
| Status | `active` |
| Branch | `feature/23-writing-tools-templates` |

## Goal

Deliver three writing instruments, a fixed color palette and configurable vector mathematical
templates, fully integrated with existing selection, history, clipboard and durable storage.
The approved behavior is SPEC §5.19; preserve accepted handwriting and floating UI.

## Design References

Existing DESIGN.md and production floating editor; extend existing tokens, Lucide icons and panels.

## Backlog

### Data
- [x] D1 Extend typed ink/template contracts, strict schema5 codec, chunked jobs/clipboard and atomic per-board migration recovery — _Depends on:_ —

### Frontend
- [x] F1 Implement pressure geometry and uniform highlighter, style-aware bounds/clipping/rendering/PNG without legacy or incremental-path regressions — _Depends on:_ D1
- [x] F2 Implement pure template generation/layout and full mixed-item selection/transform/history/minimap support — _Depends on:_ D1
- [x] F3 Implement instrument/palette/settings UI and cursor template placement with fixed toolbar, accessible cancel/error/readonly states — _Depends on:_ F1, F2
- [x] F4 Preserve opaque color ordering during drag preview and interleaved fragment grouping; add preview/commit pixel regression — _Depends on:_ F1, F3
- [x] F5 Replace undefined CSS variables in new controls with actual semantic tokens; verify visible placement CTA, selection and keyboard focus — _Depends on:_ F3
- [x] F6 Cancel armed template placement when changing writing instrument through the parameters panel; prevent accidental insertion — _Depends on:_ F3

### Other
- [x] T1 Add behavioral unit and isolated browser regressions for styles, templates, migration, clipboard and cancellation — _Depends on:_ F1, F2, F3
- [x] T2 Native desktop/narrow UI, raster/performance comparison, TypeScript LSP and independent source/security review; document hardware limits — _Depends on:_ T1
- [x] T3 Update the exact dock regression for the approved778px width and include the permanent templates control without weakening geometry invariants — _Depends on:_ F3

### Backend / Infra
None.

## Files

### Create / modify
- src/entities/board/: typed styles/templates, geometry/input/regions/history/snapshots and focused tests.
- src/features/board-document/: schema5 codec/jobs/session/IDB/recovery/fragment transport and focused tests.
- src/widgets/board-workspace/: recursive writing/template controls, native painting/placement/cursor/bindings and tests.
- src/shared/ui/editor-icon/: static Lucide symbols needed by the new controls.
- e2e/: domain fixtures, Page Objects and scenarios for approved behavior.
- scripts/architecture/: exact new native capability entries and policy fixtures only if required.
- scripts/performance/: owned workload/raster cases for new instruments/templates.
- docs/SPEC.md, docs/STACK.md, docs/FRONTEND.md, DESIGN.md, .impeccable/design.json, docs/KNOWN_GOTCHAS.md and README.md as applicable.

### Do NOT touch
- Runtime dependencies, lockfile (except npm-ci validation), hosting/workflow settings.
- User's localhost/production browser storage, Windows Chrome profiles and existing notes.
- Prior archived changes and reference projects.

## Contracts

See docs/SPEC.md §5.19, docs/FRONTEND.md and the Files list above.

## Gate Checks

Standard Fast/Full Gate. Parent owns shared checks/browser/Git; one source implementation writer.
Native smoke uses an owned strict4203 Pages preview, E2E owns4185, engine benchmarks4180.
Capture baseline af2760f before code edits. Use isolated data; no production-origin migration.
Actual Wacom pressure/lettering is manual acceptance and is not replaced by synthetic events.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- New pressure uses sealed contour strips and one native fill. Pure contour parity is exact; against the experimental full-contour native reference,54/192 cases differ only at sparse antialiased edges (worst alpha13/255), with no visible seam in the worst-three white/difference composites. Existing672 legacy and192 active/batch raster comparisons stay exact.
- One earlier100k-point stress run observed a54ms Long Task; the final100k repeat and all ordinary/styled/mixed fixtures had none. These are synthetic CPU/RAF measurements with an identical1px screencast cadence aid, not physical Wacom latency or a guarantee for unlimited scenes. Physical pressure/lettering acceptance remains manual.
- Playwriter handled native interaction/performance and desktop capture. Mobile capture stalled, so isolated Windows Chrome DevTools supplied the phone/layout/CTA/focus evidence. A fresh post-fix desktop capture also stalled; independent review accepted the source plus corrected mobile evidence. User-owned notes and browser profile configuration were untouched.

## Commit Message

```
feat(change-23): add writing instruments and vector templates
```
