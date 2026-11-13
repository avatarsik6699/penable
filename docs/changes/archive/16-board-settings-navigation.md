# CHANGE 16 — Board settings and predictable navigation

## Change Metadata

| Field | Value |
|---|---|
| Change |16|
| Slug |board-settings-navigation|
| Status |shipped locally|
| Branch |feature/16-board-settings-navigation|

## Goal

Implement the approved plan: central tool dock with settings gear and compact status, one settings/files
panel, last-writing-view return, a collapsible minimap and persistent background contrast/spacing.
Preserve floating editor visual language, safe storage, raw ink quality and recursive architecture.

## Design References

Owner initially chose top-right gear, then superseded it with central-dock settings/status and
library icons; navigation/help stay below. Return restores the latest writing VIEW, not the last
point/home/bookmarks. Minimap is initially hidden; background contrast/spacing persist with the document. Existing DESIGN/SPEC remain
visual authority; this refines discoverability and navigation, not the writing tool world.

## Backlog

### Frontend / data

- [x] F1 Add schema3 backgroundSettings/lastWritingView with strict codec/worker/snapshot roundtrips and atomic raw pre-v3 backup preserving prior recovery copies; legacy1/2 load/import defaults — _Depends on:_ —
- [x] F2 Center-preserving100% and return to completed-pen working view (world center+zoom); update on successful pen commit only, not navigation/undo/erase/paste/cancel, busy/read-only semantics preserved — _Depends on:_ F1
- [x] F3 Lazy collapsible minimap with separate cancellable worker, bounded256×160 overview data/512×320 backing cap, scene-version caching and cheap viewport overlay; click to center preservingzoom; safe all-content overview and empty/far-away states — _Depends on:_ F2
- [x] F4 Noninteractive logo, explicit settings gear/status dot (final placement viaF5), single View/Files panel with unique export/import/recovery/retry controls and error text; contrast0–100 default45 and spacing12–64 step2 default24, immediate world-anchored background — _Depends on:_ F1,F2,F3

- [x] F5 Owner steering: consolidate settings/status with primary central dock; navigation/help remain below per owner answer; replace authored icons with maintained library icons, preserve compact grouping/keyboard and pinned overlays — _Depends on:_ F4

### Other

- [x] T1 Preserve all prior behavioral tests, adapt intended schema/UI/reset semantics; add migration/navigation/background/minimap/worker cancellation/failure regressions and large-scene performance evidence; required Fast Gate/LSP/native UI review — _Depends on:_ F5
- [x] T2 Independent review, bounded design finish, native raster/paired performance, Full Gate and automatic local ship; no push/release — _Depends on:_ T1

## Files / ownership

One source writer: src/ including colocated tests and recursive modules. Parent owns docs, e2e,
scripts/architecture exact capability registry and performance harness compatibility, browser,
shared gates/Git/environment. Owner explicitly requests library icons: add lucide-react after documentation/compatibility check; do not change drawing geometry semantics.
No new router/store/drawing SDK, raw points in React, editor remount on toggles or whole-folder
platform exemptions. Only actual new modules/directories, preserving FRONTEND boundaries.

## Contracts

See SPEC5.15 (approved chat plan), FRONTEND, STACK. Restore previous view center/zoom after last pen
commit; no invented old-document lastwrite. Old1/2 default settings45/24, lastWritingView null;
background kind stays as stored. Schema3 includes validated finite bounded new metadata.

Overview uses separate lazy worker so selection/save aren't cancelled or queued behind it. Reuse
chunked transfer/cancellation patterns; return bounded portable occupancy/preview data and bounds,
never Canvas/DOM/React in worker. Scene revisions invalidate on committed changes only; no per-sample
work. Existing two ink layers retain budget; one fixed-cap overview bitmap plus cheap viewport
outline. Minimap is click-only v1; stays open during board input, main panels/diagnostics replace it.
Closed overview cancels jobs/releases bitmap/worker. At most one pinned auxiliary overlay.

Logo no longer interactive; gear opens View, status opens Files. Healthy statuses compact; errors
also have persistent short text, full recovery in same Files panel. One instance of each file/recovery
action, source recovery versions clearly distinct. Existing import remains modal.

## Gate Checks

STACK Fast/Full, no lost legacy coverage:420 baseline unit assertions/11 E2E scenarios, intentional
schema/reset/name changes updated rather than deleted. Add v3rawbackup+legacy recovery afterreload,
new metadata export/import, canceled pen/undo/erase/paste anchor invariants,100%anchor, off-screen
notes and resize, background phase/contrast/coarsening, minimap invalidation/close/import-disposal,
read-only/empty/busy and preview worker failure without document/save impact.

Native Chrome desktop1440×900/1280×720 and compact390×844 with isolated own origins only; no user
notes touched. Verify UI gestures/focus/status failure/retry/no duplicated actions and clean console.
Native raster672 exact; three warmed alternating before/after CPU pairs per STACK budget, no ordinary
>=50msLongTasks with map open, bounded preview memory and no raw main-thread point clones.
Hardware/OS clipboard remain separate. Full Gate must compare final Pages bytes to tested dist.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Owner superseded initial top-right gear/status placement with the main centered dock; static brand stays separate and navigation/help remain below. Static lucide-react imports replace authored production icons.
- Legacy1/2 constructors remain compatible internally; strict schema3 decode requires new metadata. Last-writing center permits±1e10 because valid viewport offsets at25% imply larger world centers; new navigation rejects unpersistable offsets with feedback instead of silently clamping to another area.
- Performance collector now warms navigation as well as ink before each reported fixture. Original ink-only-warmup samples are retained: sparse p95 failed despite identical measured renderer/painter code, with large A/B variance. Insufficient navigation warmup is a plausible explanation of the initial variance, not a demonstrated cause. Final first3 valid fully warmed pairs pass all20% budgets: ink10k0.5→0.5ms, ink50k2.2→2.0ms, sparse navigation1.8→1.6ms, dense navigation10.9→10.8ms; no LongTasks. One incomplete attempt aborted on RAF-throttle guard and was not included. All valid measured frame maxima remain<32ms; valid dense pair2 outlier18.4ms is retained. Dense scene cold flushes (~48–66ms baseline/~51–54ms candidate) occur before observer start and are not covered by ordinary-loop LongTask claims. Native672 raster comparisons are exact.
- Required TypeScript LSP diagnostics/status were attempted but did not return within bounded waits; tsc passed. Native Chrome and synthetic input do not certify physical Wacom feel or OS clipboard behavior.


## Commit Message

```
feat(change-16): refine board settings and navigation
```

## Verification evidence

| Check | Result |
|---|---|
| Fast Gate |448 unit tests /26files;15 E2E; tsc, full lint/architecture/spacing and formatting PASS |
| LSP | Diagnostics/status attempted; tool did not return within bounded waits, disclosed separately |
| Native Chrome |1440×900,1280×720,390×844; single dock, View/Files, trigger focus return, empty map/no-anchor, injected save failure and retry PASS |
| Native ink/map |600 mouse moves with map open:0 LongTasks>=50ms;20kstrokes/100kpoints overview ~975ms including worker+debounce,0 main-thread LongTasks,256×160bitmap unchanged on pan |
| Performance | First3 valid navigation-warmed A/B pairs PASS all budgets;672 native raster comparisons exact |
| Independent review | Source: no consequential findings. Fresh visual finish: disposition ship, no material fixes |
| Full Gate | PASS in fresh npm-ci snapshot; final Pages files byte-identical to native-tested dist |
| Hardware / OS clipboard | Not revalidated; no new physical acceptance claim |

Local artifacts are ignored under.artifacts/change-16; baseline and original failed measurements
remain available alongside the final warmed protocol. No owner data at localhost:5173 was accessed.

## Full Gate result

| Check | Result |
|---|---|
| Bootstrap / npm ci | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| TypeScript / tsc | PASS |
| Unit suite /448 | PASS |
| Lint / architecture / spacing / SAST | PASS |
| Formatting | PASS |
| E2E /15 | PASS |
| Secrets scan | PASS |
| Dependency audit | PASS |
| Migration | Browser schema1/2→3 and exact raw recovery PASS; no CLI migration |
| Backend | n/a — browser-only app |
| Native smoke / accessibility | PASS scoped UI, focus, keyboard, labels and responsive checks; formal automated audit deferred in STACK |
| Raster / performance | PASS scoped evidence above |
| Architect Review Notes |0 unresolved |
| Production bytes |4/4 exact against tested Pages artifact |
| Release / push / deploy | Not requested; local ship only |

Local ship: implementation e32ccd3, fast-forward merged into main. No push/deploy performed.

## Owner acceptance

2026-11-13: owner manually checked the current UI/navigation and accepted the stage:
«Я проверил, всё супер. Думаю можно завершать текущий этап.» No further issues reported.

## Release delivery

2026-11-13: owner explicitly requested publication of current main, including changes08–16.
The release reuses the successful Full Gate above: source/tooling/workflow are unchanged since
its checked implementation. New release checks scan current files and all Git history, verify
remote ancestry/authentication/Pages configuration, then require successful CI/deploy for the
exact pushed SHA and live asset/browser verification. The workflow is the deployment record:
https://github.com/avatarsik6699/penable/actions/workflows/pages.yml
