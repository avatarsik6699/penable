# CHANGE 15 — Floating editor UI

## Change Metadata

| Field | Value |
|---|---|
| Change |15|
| Slug |floating-editor-ui|
| Status |shipped locally|
| Branch |feature/15-floating-editor-ui|

## Goal

Implement the owner-approved Change14 design in the real editor, keeping all existing commands,
input quality, document/session semantics and recursive architecture. Owner approved the actual mock
on2026-11-13: «Выглядит отлично, предлагаю брать текущий результат и двигаться дальше».

## Design References

Binding reference: docs/design/editor-v1/index.html and previews/, its BRIEF/DESIGN.
Light full-window writing board, floating horizontal tools top-center, board menu top-left,
local save status top-right, zoom bottom-right and help/diagnostics bottom-left. Width inline;
repeat selected Pen opens stabilization. Existing actions only; mock note is never production data.

## Backlog

### Frontend

- [x] F1 Implement production visual primitives/tokens and floating workspace composition matching approved mock; keep recursive component boundaries and engine untouched — _Depends on:_ —
- [x] F2 Connect inline width/pen stabilization, contextual selection/actions, background/board menu, save/recovery/import, navigation/help/diagnostics to existing commands with one ephemeral open-panel owner, outside/Escape dismissal/focus and guarded states — _Depends on:_ F1
- [x] F3 Preserve live diagnostics while writing (pinned diagnostic help exception), keyboard/accessible naming, busy/read-only/loading/error/import/backup feedback, scrolling panels and usable compact-screen layout without canvas resize on panel/status changes — _Depends on:_ F2

- [x] F4 Preserve pending selection validation when opening nonmodal panels; cancellation only on explicit Actions Escape/modal/tool paths, including pinned diagnostics Escape — _Depends on:_ F3

### Other

- [x] T1 Adapt Page Objects to intentional UI disclosure, preserve original10 E2E scenarios and add meaningful real UI interaction/layout regressions; LSP/Fast Gate and native browser review at1440×900,1280×720 and narrow screen — _Depends on:_ F3
- [x] T2 Independent source/visual acceptance, unchanged engine raster and native input/selection/navigation smoke, Full Gate and automatic local ship; no release — _Depends on:_ T1

## Files

Source writer: src/app/styles.css; src/shared/ui/ and shared/lib/overlay if needed;
src/widgets/board-workspace presentation components/hooks/root; src/features/board-document
storage presentation components/hooks/public UI contracts. Existing model only if narrow UI contract
requires it, no engine/session behavior changes. Parent owns docs (including production DESIGN.md/.impeccable/design.json, README, KNOWN_GOTCHAS), e2e and tooling/architecture exact
capability registry (only if needed), browser/Git/environment and shared gates.

Do NOT change entities/board, writing-surface/native, codec/session/jobs/adapters, persistence schemas,
package dependencies, synthetic preview into real scene, or user data. Do not introduce global store,
event bus, per-sample React work, or whole-folder platform exemptions.

## Contracts

See SPEC5.14, FRONTEND, STACK and owner-approved mock. One workspace-owned ephemeral panel state
coordinates pen/selection/board/save/help through explicit props and narrow feature UI slots.
Existing workspace model remains command/permission authority. Reuse shared Overlay adapter for
browser dismissal/focus; views/hooks do not acquire native browser capabilities. Keep the real editor
generation mounted under out-of-flow chrome, no remount/resize from toggles/status changes.

## Gate Checks

STACK Fast/Full. Preserve all420 unit cases and10 E2E cases, test durable settings/clipboard/selection/
import/lease/worker recovery through disclosed real controls. Native Chrome: no overlap/clipping at
both desktop sizes, keyboard/ranges/menus/read-only/save failure/import, cursor ownership and no ink
through UI, no unexpected console/external requests. Compact layout must remain usable, without
inventing new mobile tools. Source-level engine equality plus existing native raster runner; CPU
batch comparison only if engine paths change. Hardware pen feeling and OS clipboard are separate.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- F4 preserves pending selection candidates when opening nonmodal panels. Explicit Actions/diagnostics
  Escape retains cancellation; normal outside/close does not cancel work. No native/model changes.
- Main chrome4.1%/5.7% at1440×900/1280×720; native browser also inspected390×844. Main panels do not
  overlap or resize/remount the canvas. Diagnostics stays visible while writing.
- Native Chrome measurement uses1px screencast for cadence, bounded600mouse moves/602savedpoints,
  select/move/actions/undo and live diagnostics:0>=50msLongTasks,0page errors. Physical pen latency
  and OS clipboard remain separate. Native raster672exact (no mismatches). Actual worker request failure/retry covered in native Chrome.
- Earlier timed-out automation runs are excluded from acceptance; owned page was closed and same
  Playwriter session reset before the completed bounded run. KNOWN_GOTCHAS records containment.
- One initial heavy-case timeout under concurrent checks did not reproduce in focused or subsequent
  full runs. Strict persisted translation assertions/deadlines remain; helper waits for DOM paint
  before enabled-state readiness. This is not a claim that busy publication itself is RAF-throttled.

## Commit Message

```
feat(change-15): apply floating editor interface
```


## Full Gate — PASS

Clean snapshot `/tmp/penable-change15-gate-v7fw7wkf`; final Pages HTML/JS/CSS/worker exactly match
browser-tested root dist. Engine/entities/native/session/codec/jobs/adapters match pre-change main.

| Check | Result |
|---|---|
| Bootstrap / npm ci | PASS |
| Root build / Pages build / typecheck | PASS |
| Unit tests | PASS420 /25files |
| Oxlint / architecture graph/platform/shape | PASS239 source+E2E files |
| Architecture self-tests | PASS52 |
| Spacing / formatting | PASS15 fixtures; no unformatted code |
| Isolated Pages E2E | PASS11; all original10 preserved, stable UI/canvas scenario added; heavy move commits while Actions opens |
| Native Chrome UI / accessibility smoke | PASS desktop1440/1280 and compact390, menus/settings/feedback/focus/diagnostics; source/static detector[]; formal audit deferred per STACK |
| Native ink / selection / navigation | PASS600 mouse moves602 savedpoints, selection/move/actions/undo, pinned pressure, pan/ctrl-wheel/reset;0observed>=50msLongTasks,0page errors |
| Failure/recovery | PASS actual worker request aborted1; explicit retry saved all3test strokes on dedicated owned4192 origin |
| Native raster | PASS672exact; no geometry/render engine edits |
| LSP | PASS231 source+8E2E,0errors/warnings;6pre-existing informational diagnostics; F4 files rechecked |
| Independent source/visual review | disposition: ship; no material fixes |
| Secrets / dependency audit | PASS0 /0 |
| Architect Review Notes |0unresolved |
| Backend / migrations / containers | n/a |
| Release | Not requested; local ship only |

Timed-out native automation runs excluded. Completed evidence used fresh reset session/owned page,
short native batches and disclosed1px screencast cadence; physical Wacom/OS clipboard unverified.
Production DESIGN.md/sidecar extracted after independent review. Test tabs/sessions and owned
preview/benchmark servers cleaned up; original localhost dev server retained.

Implementation commit67d07b4; merged fast-forward to local main. No push/deploy.
