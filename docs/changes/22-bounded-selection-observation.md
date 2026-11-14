# CHANGE 22 — Bounded selection test observation

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `22` |
| Slug | `bounded-selection-observation` |
| Title | Bounded selection test observation |
| Status | `active` |
| Branch | `feature/22-bounded-selection-observation` |

## Goal

Unblock the owner-authorized Pages release by removing whole-document transfer from the heavy
selection translation poll. Preserve the exact durable translation assertion, timeout and
undo/redo/reload fingerprints. Product behavior and strategic SPEC remain unchanged.

## Backlog

### Backend / Frontend / Infra / Data

None.

### Other

- [x] T1 Add a StoragePage active-board clipped-translation projection and use it in the existing durable selection poll; read only catalog and active record, close the database on transaction completion/abort, preserve exact assertions and timeout — _Depends on:_ —
- [x] T2 Verify the focused heavy scenario repeatedly, unchanged Pages bytes and applicable Fast Gate checks; prepare the correction for automatic local ship and the separately authorized Pages release — _Depends on:_ T1

## Files

### Create / modify

- `e2e/pages/storage-page.ts`
- `e2e/pages/board-page.ts`
- `docs/changes/22-bounded-selection-observation.md`
- `docs/KNOWN_GOTCHAS.md`

### Do NOT touch

- `src/`, runtime dependencies, persisted schemas, test fixtures, assertions/timeouts/retries and CI workflow.

## Contracts

See `docs/SPEC.md` §7.2/§8, `docs/FRONTEND.md` Tests and delivery and the Files list above.

## Gate Checks

STACK commands apply. Existing heavy fixture remains 100,000 points. Test observation must return
only clipped translations from the active persisted board, without fetching recovery records or
transporting point arrays. Compare identical Pages artifact bytes; writing engine is unchanged.
Diagnostic evidence under ignored `.artifacts/release-21/worker-probe.json` holds an actual worker
validation response through opening Actions, then verifies exact undo/redo/reload fingerprints.
No physical pen acceptance is claimed.

## Architect Review Notes

- [x] No architect review issues recorded

## Verified Behavior

Fast Gate: lint/architecture/spacing, formatting, strict TypeScript and LSP on both changed files pass.
The unchanged heavy scenario passes three repeated runs with exact existing assertions. Independent
read-only review accepts predicate parity, transaction lifecycle and active-board ownership.
The controlled worker-response probe passes Actions concurrency and exact undo/redo/reload;
observation payload falls from15,044,762bytes to31bytes (6.5–6.7s to66–71ms locally).

Full Gate: npm ci, root/Pages builds, typecheck,578 unit tests, lint/architecture/spacing,
formatting,52 E2E tests, secrets and dependency/history scans all pass. Pages artifact remains
identical across all six files. Runtime smoke/performance evidence from Change21 and the controlled
worker probe are reused because production source and output bytes are unchanged. No unresolved review notes.

## Implementation Notes

- First CI attempt failed its expensive durable translation poll; a retry was canceled after
  failing the heavy scenario and ceasing to advance. Local isolated and full runs passed before
  the correction. Observation overhead is verified; the canceled runner stall is not classified
  as an application defect..

## Commit Message

```
test(change-22): bound durable selection polling payload
```
