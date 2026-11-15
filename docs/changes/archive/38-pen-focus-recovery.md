# CHANGE 38 — Pen contact recovery after window switching

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `38` |
| Slug | `pen-focus-recovery` |
| Title | Pen contact recovery after window switching |
| Status | `active` |
| Branch | `feature/38-pen-focus-recovery` |

## Goal

Investigate intermittent Wacom writing failure after Alt+Tab in the installed app. Handle an
explicit new pen-tip transition delivered as pointermove through the existing input pipeline,
while preserving cancellation and exposing the native event fields needed to distinguish other
driver/browser failures. Existing SPEC input ownership and cancellation contracts remain.

## Backlog

### Backend
None

### Frontend
- [x] `F1` Reproduce and repair omitted pointerdown handling for explicit fresh pen-tip transitions; add contact diagnostics and focused unit/browser regression tests without restarting held cancelled contacts. — _Depends on:_ —

### Infra
None

## Files

### Create / modify
- `src/widgets/board-workspace/components/writing-surface/native/bindings/pointer-binding.ts`
- `src/widgets/board-workspace/components/writing-surface/native/bindings/pointer-binding.test.ts`
- `src/widgets/board-workspace/components/writing-surface/native/rendering/surface-diagnostics.ts`
- `src/widgets/board-workspace/components/writing-surface/native/rendering/surface-diagnostics.test.ts`
- `src/widgets/board-workspace/components/pointer-diagnostics/pointer-diagnostics.tsx`
- `src/widgets/board-workspace/model/workspace-model.types.ts`
- `src/widgets/board-workspace/model/workspace-model.test.ts`
- `src/widgets/board-workspace/adapters/workspace-platform.ts`
- `src/widgets/board-workspace/components/writing-surface/native/editor-runtime.ts`
- `src/shared/lib/messages/catalogs/en.ts`
- `src/shared/lib/messages/catalogs/ru.ts`
- `e2e/pages/writing-feedback-page.ts`
- `e2e/writing-feedback.spec.ts`
- `docs/KNOWN_GOTCHAS.md` (if warranted)

### Do NOT touch
- Document formats/storage, stroke geometry/rendering, PWA lifecycle, dependencies, existing primary/button policy.

## Contracts

See `docs/SPEC.md` §3–§5.2, §5.21, §5.26 and the Files list above. An explicit tip transition
is button=0/buttons=1, even if its native event type is pointermove; ordinary held moves never
start a new stroke. Existing single-owner/cancel/read-only/overlay guards remain authoritative.

## Gate Checks

Standard Fast/Full Gates in [STACK.md](../STACK.md). Owned smoke uses Pages preview4218 and
isolated data; E2E keeps4185. Reproduce the event sequence before the fix, verify contact recovery,
blur/capture/resize cancellation, mouse and blocked UI, saved ink/history, console and screenshot.
Native Wacom event ordering and actual OS Alt+Tab remain owner hardware acceptance. Full Gate
and independent review precede automatic local ship; release/publication remains separate.

### Verification evidence

- Focused unit regression failed before the repair; 22 unit and 6 browser cases now pass.
  Fast Gate lint/format/types/docs and changed-file LSP diagnostics passed. Independent review
  found no correctness/security issue; its active-owner fixture improvement was applied.
- Windows Chrome Playwriter verified cancelled-held/fresh-contact behavior, durable writing and
  ordinary mouse input with clean console. Screenshot capture timed out; isolated DevTools
  supplied desktop/narrow visual evidence. A bounded 12-stroke native browser probe reported
  no >=50ms Long Tasks; this is not a hardware latency benchmark.
- Owner tried Wacom with repeated Alt+Tab on the owned local Pages preview and replied
  “Пока вроде бы всё ок” (so far it seems fine). Record this as provisional device feedback,
  not proof that an intermittent driver/browser failure can never recur.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- The reported pressure0.500/pointerType does not identify the cause: current diagnostics omit
  button flags and event ordering. Hardware/browser cause remains unconfirmed without a native
  Wacom trace. The repair covers a demonstrable event-handling gap rather than proving a driver bug.

- Broader recovery from button=-1 based on earlier hover was considered and deferred: without
  a native trace it could interpret a drag from outside the sheet as a new contact. Keep native
  flags intact and do not weaken the primary/button guards to hide unknown driver behavior.

## Commit Message

```
fix(change-38): recover explicit pen contact transitions after focus loss
```


## Full Gate

| Check | Result |
|---|---|
| Bootstrap | PASS — npm ci; lockfile unchanged |
| Frontend build / types | PASS — npm run build; strict tsc; changed-file LSP diagnostics clean |
| Pages artifact | PASS — npm run build:pages; existing chunk-size advisory retained |
| Unit tests | PASS — 738 tests / 66 files |
| Documentation / archive | PASS — local links and all 34 preserved ZIP entry hashes |
| E2E lint / determinism | PASS — lint, architecture/spacing self-tests and format:check |
| E2E suite | PASS — 131 Chromium/WebKit cases, 5.3 minutes |
| Smoke / accessibility | PASS for scope — owned Windows Chrome focus/contact recovery, mouse writing, persistence and clean console; desktop/narrow diagnostic text inspected via DevTools screenshot fallback; new rows are non-interactive and bilingual |
| SAST | PASS — repository lint and architecture checks |
| Secrets | PASS — Gitleaks, no leaks |
| Dependencies | PASS — npm audit, zero vulnerabilities |
| Performance | PASS for scope — native browser PerformanceObserver reported zero >=50ms Long Tasks across 12 bounded synthetic strokes; geometry/rendering unchanged; no Wacom latency claim |
| Architect Review Notes | PASS — zero unchecked items; independent review found no defects |
| Hardware feedback | Provisional — owner reported no recurrence during local Wacom/Alt+Tab trial; no native failing trace captured |
| Backend / migrations / container | n/a — browser-only application; no schema change |
| Formal automated accessibility audit | Deferred per STACK; existing labels/focus and ordinary regressions retained |
| Release | Not requested; no push or Pages publication |

Logs: `/tmp/penable-38-full-*.log`. Source-level repair and passing synthetic/native-browser
checks do not establish a driver defect. The owned Playwriter session and automation tabs were
closed; the local preview stays available for the owner's continuing Wacom trial.
