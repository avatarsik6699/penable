# Change 46 — Board recovery and editor hydration

## Change Metadata

Branch `feature/46-board-recovery-and-hydration`. Status: shipped.

## Goal

Preserve access to healthy boards after startup fails on the active board, publish consistent storage status, and share completed geometry when mounting an editor.

## Backlog

- [x] F1 Publish one authoritative storage state across invalidation, reconnect and child events.
- [x] F2 Provide cancellable read-only recovery browsing and export, retaining the original raw record and catalog.
- [x] F3 Share completed ink geometry during editor hydration with mutation-isolation tests.
- [x] T1 Verify recovery in Chromium, including denied writer lease, stale selections, localized controls and unchanged records.
- [x] T2 Measure opening the real million-point board in three paired baseline/candidate runs, input readiness, UI delay and heap.
- [x] T3 Independent review, Fast and Full Gates, native browser smoke and local delivery.

## Files

Board-document library/session and recovery UI, workspace composition and editor hydration, board snapshots, shared locale resources, corresponding unit/E2E tests and performance fixtures.

## Contracts

See [SPEC](../../SPEC.md) §5.16 and [FRONTEND](../../FRONTEND.md). Existing wire formats and legacy recovery copies remain compatible.

## Gate Checks

Use [STACK](../../STACK.md) and the Change 46 browser scenarios above on isolated origins.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

The native smoke and paired hydration measurements used isolated synthetic boards. Full Gate passed with 912 unit and 158 browser tests. Controlled memory measurements and hardware limits are recorded in [the report](../../performance/46-editor-open.md).

## Commit Message

feat(change-46): recover healthy boards and share hydrated ink
