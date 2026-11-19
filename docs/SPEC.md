# penable — specification

> Owner-approved product contract. The Change14 visual direction was accepted on 2026-11-13
> for production transfer in Change15. The original Wacom One / Windows 11 handwriting check,
> pen/mouse distinction and changing pressure were accepted; this is not blanket hardware
> acceptance for later pen, touch or driver changes. Shipped changes are recorded in the archive.
> The public site is https://avatarsik6699.github.io/penable/; local delivery does not establish
> the currently deployed revision. Publication is a separate release.
>
> Original owner confirmation for Change06: «Отлично, всё работает» (“Great, everything works”).
> Original quality priority, 2026-11-12: «качественную доску с качественным
> письмом, чтобы не было дефектов, артефактов, блюра» (a board with good handwriting quality,
> without defects, artifacts or blur). Updating demonstration notes was authorized.

## Metadata

| Field | Value |
|-------|-------|
| Version | 1.7 — English documentation and English/Russian interface |
| Date | 2026-11-15 |
| Architect / owner | User |
| Domain | Personal handwritten notes in the browser |
| Stack | React + TypeScript, Vite + Canvas 2D, IndexedDB; see [STACK.md](STACK.md) |

## 1. Project Overview and Goals

### 1.1 Problem

A personal workspace for writing text and diagrams with a drawing tablet, arranging material
freely and returning after closing the app. Handwriting quality and note safety determine
whether the product is useful.

### 1.2 Goal and acceptance

Daily-use goal: open a board, write notes, close the browser and resume with completed content
and the saved view. The first milestone tested input only: several handwritten lines, fast loops,
short strokes and dots on the owner's tablet. The owner judges line fidelity, perceived lag and
unwanted gestures. Until that check, compatibility and writing comfort on a device are unverified.

### 1.3 Historical milestone boundaries

This table records the original delivery sequence, not current missing features. Later §5
contracts supersede earlier exclusions. Current storage is document5–6/catalog2/IDB1; named boards,
images, transforms, instruments, mathematical templates, touch navigation and the offline shell
are implemented. Physical acceptance and public deployment remain separately qualified.

| Stage | Original inclusion | Originally deferred |
|-------|--------------------|---------------------|
| M1 — complete | One writing surface, pen/mouse, black constant-width pen, width, diagnostics, resize/DPR, launch guide | Navigation, undo/redo, storage, import/export |
| M2 — board | Change02: stroke quality/navigation/clear zoom; Change03: backgrounds/history | Multiple notebooks, collaboration |
| M3 — regular notes | Change04: IndexedDB, reload, save status, JSON backup/restore | Cloud sync, PNG/PDF |
| M4 — improvements | Change05: eraser; Change06: UX; Change08: exact selection/move and fragment PNG | Partial eraser, resize/rotate, multiple notebooks |

M1 was a temporary in-memory input stand and explicitly lost notes on reload. The app was not
presented as a place for important notes until M3 added storage and recovery.

## 2. Domain Context

### 2.1 User and environment

One person on their computer, without accounts or application roles. Primary input is a drawing
tablet; mouse input supports checks and fallback use. The owner confirmed Wacom One / Windows 11,
writing, pen/mouse distinction and changing pressure in diagnostics. Browser/driver versions were
not recorded and quantitative hardware characteristics were not measured. Development is in WSL;
verification uses ordinary Windows Chrome as well as isolated automated browsers.

### 2.2 Entities

Stroke is a completed stroke; Point is an input coordinate/data sample; ActiveStroke is one
pointer's unfinished stroke; Viewport maps board coordinates to the screen. Document combines
content and metadata. Later contracts add ordered ink/image/template items and a board library.

## 3. Data Model

### 3.1 Historical M1 — tab memory only

| Object | Data / invariant |
|--------|------------------|
| Point | Finite numeric x/y in logical units, event pressure and sample time; zero pressure is valid |
| Stroke | Unique id, black color, positive width, nonempty ordered points |
| ActiveStroke | One pointerId, current points, width captured at stroke start |
| Scene | Completed strokes separate from the active stroke; redraw source |

Stroke coordinates do not depend on canvas bitmap resolution or devicePixelRatio. M1 mapped
screen CSS coordinates to local surface coordinates with unit viewport scale. Navigation extends
that transform without storing bitmap coordinates. Resize does not scale/delete completed
strokes; hidden content becomes visible when the surface grows. M1 pressure intentionally does
not affect width; pressure in an event alone does not prove variable device pressure support.

### 3.2 Board coordinates and persistence

Change02 stores world points. Viewport holds zoom and CSS x/y offset: screen = world × zoom +
offset; input uses its inverse. Zoom anchors the world point under the cursor, and navigation
does not alter raw stroke coordinates.

Each new stroke captures stabilization0–100% and start zoom. Raw points are never filtered in
place. Missing profile means no extra filtering; old off/light/strong profiles retain their
geometry as0/50/100%. Settings changes do not reinterpret earlier writing.

Change03 history operates on completed strokes: undo retains the last object for redo; redo
restores the same raw points, width and profile. New completed ink clears redo; cancellation,
navigation, backgrounds and settings preserve it. Unfinished ink is not history. M3 persists
versioned documents and viewport in IndexedDB. Import validates shape, finite numbers and version
before mutation; invalid imports preserve current content. The exact later formats and limits
are governed by §5.6 onward. Current documents use version5–6 and read1–6. The catalog and
IndexedDB versions remain2 and1.

## 4. API / Backend Contract

No application server, HTTP API, server database or secrets are required. Vite serves development
files; production is static assets. The app does not upload strokes.

Flow: Pointer Events → input controller → content model → Canvas2D. React owns controls and UI
state; sample collection/rendering do not require React renders per movement. The controller is
independent of React/IndexedDB, and the renderer does not own canonical data. Persistence follows
document changes. No global scene store, router, drawing SDK or WebGL engine is required.

Alternatives considered: React state per sample simplifies UI wiring but adds work to the input
path; a drawing SDK accelerates a rich interface but introduces dependencies/constraints before
pen validation. Keep a small independent controller and Canvas2D; revisit against measured limits.

## 5. Frontend / Client Contract

Sections5.2–5.13 preserve historical delivery contracts. Later instrument, library, touch and
availability sections explicitly extend them; read a historical schema or exclusion in that context.

### 5.1 Screen

One route `/`: full-window writing surface, floating tools and contextual panels per §5.3/5.14.
Local storage status and failures are explicit. Diagnostics are available through Help and can
remain open while writing. No additional pages are required.

### 5.2 Historical M1 writing and states

- Pen tip and primary mouse button draw. Hover, right button and touch do not start ink in M1.
  A second pointer cannot continue/replace the active stroke; later touch behavior is in §5.21.
- Width0.5–12 logical px, step0.1, default3; changes affect the next stroke.
- A single contact leaves a dot; moving ink is visible before release.
- pointerup commits the final point. Pointer capture retains the sequence outside the surface;
  visible painting stays clipped to the work area.
- pointercancel, unexpected capture loss, window blur/unmount and real resize cancel unfinished
  input while preserving completed content. Returning without a new down does not draw.
- Use getCoalescedEvents when available, otherwise the original event; do not duplicate parent
  samples. M1 requires no prediction, pointerrawupdate or strong smoothing.
- Suppress native gestures/context menu only as needed within the writing surface; preserve
  normal browser behavior elsewhere.
- Resize/DPR preserve logical geometry. Dispose listeners/observers/frames; StrictMode must not
  duplicate input. Canvas2D unavailability has an explicit reason and supported-browser guidance.

Diagnostics show actual pointerType/pressure, active stroke, coalesced-event availability and DPR.
Updates are bounded and do not delay ink. Constant pressure is valid for constant-width writing.
Event frequency is not measured end-to-end latency; automatic tablet-model detection is unnecessary.

### 5.3 Design System

Updated by owner approval on2026-11-13 of docs/design/editor-v1: light full-window board,
floating horizontal tool dock top-center with settings gear/compact status; static brand top-left,
zoom/return/minimap bottom-right, help/diagnostics bottom-left. Width is inline; repeating the
selected Pen opens stabilization. The actual HTML/CSS and PNGs are the approved reference;
synthetic handwriting is demonstration content, not hardware acceptance.

White paper/chrome, ink#182230, muted#526176, blue#175CD3, error#B42318, subtle offset shadows,
40px minimum interactive targets, Segoe UI/system sans-serif and one Lucide SVG family. No network
font dependency in production. Tool/status panels are out of flow and never resize/remount canvas.
Secondary actions are disclosed without permanent instruction rows. Loading/error/read-only/
busy/import/recovery and selection feedback stay explicit. Compact controls/panels remain usable;
this historical design transfer itself introduced no mobile drawing behavior.

### 5.4 Writing quality and navigation — Change02

Keep §5.3 styling. Provide zoom out/current percentage/zoom in and view reset. Own zoom25–800%,
default100%. The original wheel/ctrl-wheel zoom behavior was superseded by §5.8 plain-wheel pan;
Ctrl+wheel/trackpad pinch remains cursor-anchored zoom. Space+primary/middle drag pans without ink.
Browser Ctrl+plus/minus remains native; wheel is not intercepted outside the board. +/− zoom about
the surface center;100% sets zoom1 around the current center (§5.15), retaining the viewed area.

Retain raw points/pressure; derive geometry deterministically with one path algorithm for active,
commit and redraw. Consecutive duplicate XY adds no segment. Change02 width is constant and
scales with the board; later instruments add pressure width. Moderate smoothing must not visibly
lag or distort letters; raw data remains available independently of presentation.

After blur was fixed, the owner observed shaky lettering and confirmed a hardware improvement,
then requested intermediate stabilization strength. Replace three modes with0–100%, step1,
default65%:0 is off,50 equals legacy light,100 equals legacy strong. Below50 continuously blend
light-filtered and raw positions;50–100 linearly interpolate the legacy light/strong parameters.
Stabilization is a pure pre-curve adaptive2D speed low-pass with a shared axis coefficient,
without prediction or future-sample waits. Capture correction limits in CSS units at stroke start;
subsequent zoom does not change the shape. Filtered support-point deviation is bounded to1.5/3CSSpx
at50/100%, proportionally smaller below50. First/last positions remain exact; replace the filtered
last position rather than adding a backward tail. Repeated XY with different pressure/time does
not advance filtering. These are geometry limits, not measured latency or a guarantee of Miro parity.

Completed scene and active ink use separate layers. Draw the active layer at most once per frame
as one path; an accepted retained-raster implementation may clear/repaint only conservatively
bounded dirty device-pixel regions with byte-identical output. Do not traverse completed ink per movement. Commit transfer must not leave tails,
seams or jumps. Viewport/DPR/native pinch redraw geometry instead of CSS-stretching a bitmap.
Use visualViewport.scale with devicePixelRatio. Total two-layer budget16,777,216pixels (~64MiB
raw RGBA excluding overhead), max side8192; expose effective-resolution capping in diagnostics.
Owner-approved performance follow-up allows up to16MiB of additional editor-owned raster cache,
allocated only when needed and released with its generation. This ceiling does not reduce the
existing layers' resolution or permit changing stored samples, stroke geometry or opacity.

Acceptance: own zoom100/200/400%, DPR1/2, page zoom/native pinch; no post-commit raster enlargement,
gaps, artificial reverse segments, dark seams or pointerup shape change in dots/loops/diagonals/
short strokes. Normal edge antialiasing is expected. World/screen and anchored-zoom round-trip
error≤1e-6 in unit fixtures. Real resize/DPR cancels active ink and preserves completed content;
no-op repeated observer callbacks do not cancel it. Own navigation is blocked during ink. The
owner separately evaluates lettering and perceived lag on physical Wacom hardware.

### 5.5 Historical next steps — Change03

Complete the board with undo/redo controls and Ctrl+Z/Ctrl+Shift+Z (Meta equivalents). Use physical
KeyZ for Russian keyboard layouts. Empty actions are disabled; ink/pan blocks history. Board/tool
shortcuts are handled, while text inputs/select/contenteditable retain native undo. Ignore Alt,
composition and already-prevented events. Update enabled flags only at operation boundaries,
without per-point/navigation React renders. Undo/redo performs a geometry redraw; commit→undo
before RAF cannot leave ghost ink.

Background choices are blank(default), dots and grid: a CSS pattern below two transparent canvases,
not ink/history or an extra bitmap. Base spacing24world units, doubled by powers of two until
screen spacing≥12CSSpx. Anchor pattern to world origin through negative offsets and zoom; keep
lines/dots around1CSSpx in a subdued color. Switching preserves strokes/redo/input and bitmap
budget. Check negative offsets, zoom and narrow layout. At this historical stage backgrounds and
history were tab-memory settings; M3 added persistence.

### 5.6 Local storage and backups — Change04

Historical first persistence contract: native IndexedDB database `penable` version1, object store
`documents`, key `main`. The document and editable JSON shared this initial structure:

```ts
type BoardDocument = {
  format: 'penable-board'
  schemaVersion: 1
  strokes: Stroke[]
  viewport: Viewport
  background: 'blank' | 'dots' | 'grid'
  tools: { width: number; stabilization: number }
}
```

Current document5 and named-board storage extend this shape in later sections; the old declaration
is retained to explain compatibility. Persist only completed ink, without pointerId/active state,
pixels, diagnostics or redo. Load/import establishes a fresh history baseline: undo covers later
actions, not original creation of loaded content. Erasing loaded ink and undoing erasure is allowed
by §5.7. Old stroke objects/profiles retain geometry; viewport/background/width/stabilization reload.

Disable editing/autosave until initial load/validation succeeds. Defaults must not overwrite data.
Missing `main` means a new empty board; corrupt/unsupported/open errors are explicit with retry
and import recovery, preserving the original record.

Commit/undo/redo schedule writes; viewport/tools/background debounce~300ms, maxwait1500ms. Detach
a snapshot only before writing, not per point/movement. Serialize revisions; an old completion does
not mark newer changes saved. Saved requires transaction.complete for the current revision, not
request.success. Failure preserves memory and exposes retry/export without endless auto-retry.
Hide/close flush is best effort; unsaved changes require a beforeunload warning. Forced termination
does not promise the last operation is durable.

One origin tab holds exclusive ifAvailable Web Lock `penable:board:main`. Other tabs load read-only
snapshots: view/export/navigation are allowed, ink/settings/import are blocked. Explicit retry
acquires authority and reloads current data before editing. Missing Locks API is an explicit write
capability error, never an unreliable emulated lease. Cleanup drains/stops writes, closes DB, then
releases the lock; ignore stale async callbacks. versionchange closes the connection and blocks
writes until safe retry. Later library authority retains these ownership guarantees.

Export uses current completed memory, including unsaved changes, even if IDB fails. Exclude active
ink. A browser download request is not proof of filesystem persistence. Import checks file size
before reading; then JSON/schemaVersion, known fields/enums, finite/ranged values and unique
positive safe IDs. Coordinates/offsets have absolute value≤1e9, time≥0, pressure0–1, width0.5–12,
strength0–100, zoom0.25–8. Accept numeric profiles or legacy off/light/strong without ambiguous
combinations. Reconstruct known fields rather than spreading untrusted JSON.

Initial resource guards:64MiB/file,20k strokes,1M totalpoints,100k/stroke. These are technical limits,
not proven near-limit performance. Do not truncate on overflow: save/import explicitly fail while
memory remains exportable. Out-of-format export must warn that reimport is unsupported; round-trip
is promised only within validated limits.

Validated import shows stroke/point counts and an explicit Replace board confirmation. Until then,
nothing changes. Replacement requires idle input/pan, blocks mutations, drains/serializes after
pending writes and atomically stores prior completed memory(including unsaved) in before-import
and candidate in main. Recovery after load failure preserves exact raw main instead. Only
transaction.complete replaces live content/settings and surface generation, seeds IDs and starts
empty session history. Error/cancel preserves prior live/durable state.

The previous copy remains downloadable after reload for valid documents or JSON-safe raw trees:
plain objects/dense arrays, finite numbers and JSON primitives. JSON.stringify success alone is
insufficient: positively reject Map/Set/Date, undefined, BigInt, NaN/Infinity, cycles and other lossy
values before download. Arbitrary corrupt/non-JSON IDB values remain unchanged in raw backup;
explain unavailable JSON export instead of emitting an empty file. Keep one before-import snapshot;
the next confirmed replacement overwrites it, including unsupported raw values. Do not promise
indefinite retention or support for foreign formats.

UI has an accessible role=status for loading/dirty/saving/saved/error, import/export controls and
clear retry/read-only/recovery messages. Replace M1's reload-loss notice with local-browser storage
and backup guidance. Change04 added no account/server/cloud/PWA; §5.23 later adds offline launch.
Site-data clearing can still delete content.

### 5.7 Whole-stroke eraser — Change05

Owner-approved pen/eraser switching, touch/sweep whole-stroke deletion, undo/redo and persistence at
any zoom. Preserve compact light §5.3 UI, labeled aria-pressed controls, selected color/border and
≥40CSSpx targets. Explain whole-stroke behavior before use.

Tool selection is session-only, outside JSON/IDB; initial load/import selects Pen. Width and
stabilization remain pen settings through switching. Block switches during input/pan, read-only,
load/import, using synchronous guards before React updates.

Primary pen/mouse contact erases; hover/second pointer/right button do not. Change05 added no touch
or automatic tablet-button mapping. One down→up removes all hit strokes as one history action.
Target radius8CSSpx plus visible half-width, divided by zoom in world space. Hit dots/short/long
lines/round caps/stabilized curves using rendered derived geometry, approximation error≤0.25CSSpx.
Sweep the whole segment between samples, including coalesced samples, to avoid fast-motion misses.
Raw points stay unchanged.

During contact, hide hits only in preview. Canonical scene/snapshot/IDB remain unchanged until
successful pointerup; mid-preview flush/export includes original ink. pointercancel/unexpected
capture loss/blur/resize/write-authority loss/modal/unmount or primary-button loss on move cancels
preview. Successful release commits removal through the existing revision queue.

History stores add/group-erase actions with original objects/indices. Undo restores all erased ink
at the same positions/geometry/metadata/order; redo removes it again. Loaded ink can be erased and
restored, but undo cannot undo its pre-load creation. New nonempty erase/commit clears redo;
miss/cancel/tool switch/navigation preserves redo without writes. UI updates at operation boundaries.

Eraser blocks history, own zoom/pan and import while active. Idle Space+drag/middle pan still works.
Preview/cancel/removal/history invalidate completed layer and pending commits, preventing ghost
lines before RAF. Preserve accepted geometry/stabilization/two-layer budget. Historical format1
saved only remaining strokes; later schemas preserve fragments/items.

Change05 excludes partial erasure, adjustable eraser size, hardware switching, new colors/cloud/
dependencies and near-limit speed promises. Test zoom25/100/400/800%, pan, stabilized hits/misses,
group history/order/cancellation/read-only/save/JSON round-trip and desktop/narrow. Wacom eraser
comfort remains the owner's hardware check. Later selection can split ink (§5.9); it is not a
partial-eraser implementation.

### 5.8 Input stabilization and UI/UX — Change06

Owner-approved plan; preserve the light composition. This supersedes early wheel→zoom behavior
and the canvas focus border.

**Cursor.** A separate presentation overlay shows a dark3CSSpx pen/mouse dot with1px light halo,
8CSSpx eraser ring or pan hand. It is not ink/snapshot/JSON and has no per-sample React state.
Local CSS coordinates, no world/zoom/DPR multiplier, one RAF update; constant screen size under
board zoom. Hide the OS cursor inside the board only when the app cursor is ready. Hover/down/up
do not toggle dot visibility. Pen leave retains the last valid digitizer position, never0,0.
Tools/outside/modal/blur/hidden hide it; return cannot create duplicate cursors. Only the active
pointer moves it during contact. Touch/compatibility mouse events add no extra cursor. Dispose
listeners/RAF under StrictMode/unmount. No event means retain last position, not OS cursor control.
Later §5.26 refines pen terminal-event handling without altering accepted ink input.

**Focus.** Keep canvas tab-focusable without a blue frame. A small Canvas badge appears for Tab
entry, hides for pointer input/blur. Controls retain visible keyboard focus; do not globally remove
outlines, shortcuts or focusability.

**Navigation.** Plain wheel pans both axes: offset -= normalized delta, following system/browser
direction. Pixel mode1:1, line mode16CSSpx, page mode uses the respective surface axis dimension.
Shift+vertical maps to horizontal; do not remap existing horizontal deltas. Ctrl+wheel/pinch zooms
25–800% about the cursor; preserve Space+primary/middle pan. Input supplies finite deltaX/Y,
deltaMode, Ctrl/Shift, anchor and surface dimensions. Canvas-only nonpassive handling prevents
page scroll/zoom leakage at zoom limits or while busy. Ink/erase/pointer-pan ignores wheel; a
stream overlapping contact and its inertia stays quarantined until≥150ms quiet between events.
Use a clock in the pure controller, not per-sample timers. Read-only navigation never persists.

**Stable UI.** Since Change16, status/settings live in the top-center dock (§5.15), while export/
import/backups live in Files and copies. Detailed messages/notices/retry are in out-of-flow
nonmodal panels; §5.14 replaces the former permanent row. Dynamic status/error/recovery cannot
change canvas bounds for the same viewport, cancel gestures or steal focus. The main indicator
always exposes errors ahead of read-only status; full text/recovery remain available and errors
do not auto-dismiss. Repeat trigger/outside/Escape closes the bounded scrollable panel. Import
validation/confirmation/backup remains modal. Hide cursor over overlays; controls are keyboard
accessible with40px targets. Zoom disabled flags use immediate busy state, not100ms diagnostics;
synchronous guards remain authoritative.

Preserve geometry/stabilization/sample collection and historical schema1 persistence. Real
resize/blur/authority loss cancels unfinished gestures safely while completed content remains.
Test cursor lifecycle/mixed pointers/zoom/DPR, wheel axes/modifiers/units/inertia/busy, keyboard/
panel/layout stability and pen/eraser/history/IDB/JSON regressions on desktop/narrow. Synthetic
pen/wheel does not prove Wacom/Precision Touchpad setup. Hardware acceptance stays separate;
automated gates/review trigger local ship under owner policy, while push/deploy need release.

### 5.9 Exact selection and move — Change08

Owner approved on2026-11-13: «Продолжай разработку по плану» (“Continue development according
to the plan”). Rectangle/lasso selects only painted content inside the region, including parts
of crossing strokes. Move/copy/cut/paste/delete/duplicate/select-all/deselect and undo/redo are
included. This stage excludes inversion, whole-board crop, resize/rotate/flip and external images;
later contracts add transforms/images.

**Controls/UI.** Selection has Rectangle/Lasso and compact Actions over the board without resizing
it. Reveal full commands on demand; close after a command/repeated trigger/outside/Esc. First Esc
closes Actions; the next deselects. Preserve visible keyboard focus and accessible errors. This
stage has no resize handles. Freeze selected fragments until the next selection; moving over
other writing cannot adopt it. Pen/mouse reuse ownership/cancel. Use stable arrow/move app cursors,
not a crosshair. Ctrl/Meta+A/C/X/V/D, Delete/Backspace and Esc apply only to the board, leaving text
fields/dialogs/native text clipboard untouched. Arrows move1CSSpx, Shift10CSSpx; one key hold is one
history operation. Paste centers in the current view; duplicate offsets24CSSpx at current zoom;
both select the result. Esc cancels unfinished work or deselects at rest; outside click starts anew.

**Navigation.** Idle selection survives wheel/pinch/Space pan. Marquee/drag blocks normal navigation
and retains wheel inertia quarantine. Drag edge-pan uses a32CSSpx zone, smooth acceleration up
to600CSSpx/sec and bounded RAF timestep. Cancel restores fragments and starting viewport; successful
move keeps viewport, and undo restores only ink. Fit all uses visible ink bounds,48CSSpx padding,
zoom25–800%; empty scene uses initial view. Hidden source ink cannot inflate bounds. Resize/blur/
lost capture/read-only/import cancel preview.

**Geometry.** Never cut/refilter raw samples. Retain full source stroke/profile, source lineage,
local MultiPolygon vector clip mask and translation. polygon-clipping0.15.7 supplies intersection/
difference/union; lasso preview/normalization/render uses nonzero fill. Clip the full painted width,
including edges whose centerline is outside selection. Same-source/same-translation fragments render
once with unioned masks: complementary clips cannot leave AA seams after moving back. Lineage is
separate from reusable item ID; paste/duplicate get new lineage. Eraser hits/removes only the visible
fragment, preserving distant siblings. Keep accepted curves/filter, two-layer budget, no per-sample
React and balanced canvas save/restore.

**Atomicity/data.** Selection/copy/zero move does not mutate scene/history/save. Preview is excluded
from snapshots/JSON. Each complete operation is one replacement history action(removed/inserted
objects+indices), restoring identity/order on undo. Prepare/validate the whole candidate first;
geometry/limit failure preserves scene/selection/history/redo. Clipboard/region/cursor/unfinished
operations are transient.

Schema2 was required because a schema1 decoder would drop clips/translations and restore hidden
ink. Read schema1 JSON/IDB unchanged; keep DB/store1. First schema2 write atomically preserves exact
raw schema1 main as before-schema2 if absent. before-import remains separate. Expose the upgrade
copy in storage; update codec/clone/snapshot/stats/import/export/session/repository together.
Unknown versions are not reset. Stored JSON trees are independent even when runtime fragments share
source geometry. Validate IDs/lineage/source agreement/translation/topology. Preserve64MiB/20kitems/
1Mpoints/100k-per-item, counting repeated raw points. Add2048lasso vertices,8192mask vertices/item,
100000/document. No partial paste, silent truncation or handwriting simplification on overflow.

**Clipboard/PNG.** Historical Change08 kept immutable editable fragments within the tab until
reload and did not read system clipboard. Change18 supersedes that with the native editable+PNG
clipboard contract. Separate image-copy derives transparent PNG from vectors, excluding background/
cursor/selection:2pixels/worldunit, independent of current bitmap, max side8192/16,777,216pixels.
Explain oversize rather than silently downsampling. Write ClipboardItem image/png only on user
action; denial preserves internal copy and offers PNG download. Async output cannot mutate scene/
selection; release temporary bitmap. Read-only allows select/copy/PNG but no mutations. Preserve
all prior loading/error/modal/focus rules.

**Acceptance.** Units cover geometry/footprint/clips/history/input/limits/PNG. Actual browser covers
both selection modes, partial strokes, moving/clipboard/export/reload, edge-pan/fit-all/keyboard/
cancel/read-only/migration abort. Check AA seams at25–800%, DPR1/2 and fractional translations,
desktop/narrow and console. Physical Wacom and Windows clipboard checks stay separate. Local ship
after gates/review is automatic; Change08 did not authorize release/push.

### 5.10 Selection region and responsiveness — Change09

Owner clarification2026-11-13: preserve the exact drawn selection, Paint-style, including empty
margins; do not shrink outline to ink. Rectangle retains world bounds, lasso retains normalized
region. Drag/arrows move region with contents. Copy/cut preserve region; paste centers it and
duplicate offsets24CSSpx. Empty regions can be shown/dismissed; content commands are no-ops without
ink. Select-all uses visible content bounds. PNG retains transparent margins and existing2x/budget.
Region is transient and schema2 unchanged. This change adds no images/fill/primitives; the region
model must support their later clipping under the same contract.

Remove synchronous ink-bound recomputation from outline/hit/cursor. Measure the full marquee→
release→drag→commit→save path, separating geometry, bounds/fit/PNG and redraw. Cache immutable
sources/masks only, not mutable active ink. Preserve line quality and exact visible clips. Avoid
repeated Boolean work per pointer event; preview once per RAF, never persist intermediate states.
Chunk/offload measured blocking work with cancellation/generation guards. Never apply stale output
after cancel/blur/import/read-only/dispose; errors preserve old scene/undo/redo.

Engineering acceptance uses identical before/after fixtures(500/2000-point writing,10k-point long
stroke,200×50-point notes, dense/complex lasso, near-limit stress), cold and repeat runs. Record
release/drag-frame/commit/save times and attributable main-thread LongTasks≥50ms, not just helper
means. Ordinary selection/move fixtures have no attributable long tasks; heavy cases remain
responsive/cancellable. Disclose workload limits/unperformed hardware checks; no universal zero-lag claim.

### 5.11 Writing and large-note performance — Change10

Owner-approved2026-11-13: retain React/TypeScript/Canvas2D and historical schema2. Process active
ink incrementally: new points and mutable tail without refiltering the whole prefix. Each prefix
matches accepted batch geometry, exact tip, legacy profiles, duplicateXY and captureZoom. Retain
all raw points/pressure/time; speed cannot come from quality loss.

A reproducible stand compares identical production engine/app workloads before/after: continuous
writing, distributed/dense notes, pan/zoom, selection/move, undo/redo and background save. Record
frame/operation times, LongTasks≥50ms, memory and environment. Ordinary fixtures:500/2000-point
writing,10k-point stroke,200×50-point notes; large:2000/10000×50points.20kitems/1Mpoints is stress,
not a60fps promise. Ordinary operations permit no attributable≥50ms tasks; compare frame
distributions rather than helper means alone.

Optimize navigation/memory only for measured causes: invisible items, duplicate computation,
history and cache release. Do not automatically cap undo. Separate useful history from leaks;
repeated create/dispose cannot retain old engine/documents. Preserve documents/JSON/selection
regions/clipping/order/AA/save/cancel/error/recovery contracts. Physical Wacom latency and feel
remain separate hardware acceptance.

### 5.12 Architecture and composition — Change11

Owner-approved2026-11-13 adaptation of applicable infraegev2 architecture/style, including browser
fixtures/Page Objects. Binding contract: [FRONTEND](FRONTEND.md). Owners: app → widgets/board-workspace
→ features/board-document → entities/board → shared. Core knows no React/DOM/codec/worker protocol;
document feature owns DTO/strict validation/recovery, workspace owns native Canvas/DOM. Scoped UI
snapshots are separate from mutable scene and file DTO. Preserve historical schema2/reads1, IDB1,
backups, UI, geometry/stabilization and guards.

Refactor types/props/effects/kebab-case/CSS Modules/semantic tokens, explicit factories/public APIs
and executable policies. Remove moved legacy directories; do not bundle duplicate old engines.
Baseline main5624f9e; preserve meaning of672native raster cases/408unit assertions. Three paired warm
runs require median p95≤max(1ms,baseline×1.2), no attributable≥50ms normal tasks. Isolated Playwright
checks the same Pages artifact on4185; interactive verification uses Playwriter. Automatic local
ship follows Full Gate/review. New product features and release are separate.

### 5.13 Fractal decomposition — Change13

Owner clarification2026-11-13: retain outer layers; recurse within modules with local components/,
real hooks/, submodules and scoped *.types.ts/*.utils.ts/*.config.ts. FRONTEND is binding. Decompose
large components/native orchestration/selection/regions/document lifecycle by real responsibility,
not just file moves. Public submodule APIs hide internals; dependencies stay acyclic. Preserve UI,
schemas/backups/pen quality. Baseline4345ce1; preserve416unit/672raster/9browser scenarios. Native
changes use §5.12 CPU/RAF budget; physical latency remains separate. Local ship after checks and
independent review; release stays a separate instruction.

### 5.14 Floating editor UI

Change15 implements the owner-approved Change14 reference in production. Existing engine, geometry,
persisted document schema, limits, permissions and commands retain their contracts. UI disclosure
is ephemeral and coordinated by one workspace owner: at most one nonmodal board/save/pen/selection/
help panel. Outside interaction dismisses, Escape closes and returns focus to its trigger; expanded
diagnostics can stay pinned during board input so live pressure remains observable, with explicit
close/Escape and replacement by another panel. Existing
modal import retains protected focus and command blocking. Toolbar/control interaction must not
write ink. Feedback and saving changes do not change board dimensions or reset the view/history.
All existing capabilities stay reachable: tool/width/stabilization, undo/redo, rectangle/lasso and
all selection commands/PNG, import/export/recovery/background and diagnostics; navigation is refined by §5.15.


### 5.15 Board settings and predictable navigation

Approved2026-11-13: logo is noninteractive; gear and compact status are inside the main central top dock,
not in a separate right-hand pill. Gear opens View and compact status opens
Files in ONE settings panel. Healthy statuses are a small dot (green saved, yellow dirty/saving,
gray loading/read-only with textual/lock semantics); error is red plus persistent short text.
Hover/focus/accessibility expose status text; no color-only meaning. File export/import/recovery/
retry appear once. Existing modal import, outside/Escape/focus and busy/readonly guards retained.

100% changes zoom around current screen center, never resets camera to world origin. Return-to-writing
restores world center+zoom captured only on successful completed pen stroke, before durable save
capture. Navigation/eraser/undo/redo/paste/import/cancel don't invent a new last writing location.
Imports use their saved metadata; old1/2 documents have null lastWritingView until new pen commit.
Resize restores the same world center/zoom, not old pixel offsets. Empty/no-anchor return is disabled.

Minimap is initially hidden, click-only (no drag v1), bottom-right above navigation. It stays visible
during drawing/pan, main panels/diagnostics replace it. It shows approximate occupied content regions
and current viewport; outside-domain camera is indicated at the edge, not silently reframing on pan.
Scene bounds/domain change only with accepted scene revisions. Clicking changes center at current
zoom. All-content framing is secondary inside map; if zoom>=25% cannot fit all notes, don't jump
into an empty gap: explain and let the user choose the region on map. Empty scenes have no jump.

Background kind stays blank/dots/grid. Shared contrast0–100 step1 default45 (% opacity of neutral
#526176), world spacing12–64 step2 default24. Fixed screen-sized dots/lines, world-anchored phase,
adaptive coarsening at low zoom retained. Blank hides controls but retains settings. Changes preview
immediately, autosave through existing debounce, no ink/history mutation. Read-only disables edits.

Schema3 adds backgroundSettings {contrast,spacing} and nullable lastWritingView {center:{x,y},zoom}.
The center is finite and bounded±1e10; existing viewport/ink coordinate limits stay unchanged.
New navigation requests outside valid persisted viewport bounds leave the view unchanged with a short explanation.
Read1/2 with defaults; write3. Preserve the exact raw pre-v3 main atomically on first upgrade in
before-schema3, without overwriting before-import/before-schema2. Store structure staysIDBv1;
recovery copies are listed once in Files with distinct purposes. Strict metadata validation and
bounded chunked worker envelopes/roundtrips must preserve every new field.

Minimap work is lazy and separate from selection/durable worker, cancellable/generation checked.
Portable overview data bounded256×160, bitmap cap512×320; raw scene stays out of React. Cached
content changes after canonical edits, viewport outline updates cheaply on camera movement. Closing
releases resources. No new dependency, automatic main-cluster heuristic, bookmarks or home view.


Owner refinement during Change16: use lucide-react named imports for all production icons instead
of authored glyphs. Main top-center dock groups tools/history/contextual controls plus status/settings;
bottom navigation and Help remain. Existing established light style and compact touch targets retained.


### 5.16 Transformable content, images and named boards — change17

Owner2026-11-13 explicitly authorizes planning AND complete implementation of selection resize/
rotation, PNG/JPEG insertion/editing and multiple boards, without intermediate approval pauses.
Offline/PWA remains excluded. Existing light Operate surface, centered primary dock, Lucide icons,
lower navigation/help, raw handwriting quality and recursive FSD boundaries remain binding.

**Scene and transforms.** One ordered BoardItem union (ink or image) owns drawing order; no fake
image strokes/dummy points and no separate unsynchronized ordering table. Immutable ink sources
retain raw points, profiles and width. A finite invertible six-number affine local-to-world matrix
composes resize/rotation/translation; clips remain source-local. Legacy translations normalize on
load. Identity/translation rendering retains existing fast paths and floating point ordering.
World bounds retain existing coordinate guards; invalid/singular/out-of-range transformations
reject atomically with readable feedback. No repeated point baking or rasterizing handwriting.

Selection retains the actual rectangle/lasso region and whitespace. Eight resize handles and a
rotation handle act in screen-sized hit areas before ordinary move hit-testing. Opposite anchor
stays fixed; Shift preserves proportions during resize and snaps rotation to15degrees. No zero
scale or crossing into accidental mirroring. Compute every preview from pointerdown state, outside
React. Pointerup commits one history replacement after validation; Esc/blur/resize/lost capture/
permission loss restores the exact prior scene. No-op keeps redo. Keyboard users can enter width/
height percentages and angle through selection actions; labels and numeric units are explicit.
Partial ink/image selection inverse-transforms the world mask into each source's local coordinates.
Source lineage + full matrix + item kind governs seam-free grouping. Eraser continues to erase ink,
including nonuniformly transformed ink using inverse-transformed world sweep, never images.

**Images.** Toolbar file control, board drop and native paste accept PNG/JPEG. File/paste insertion
centers in current view and fits large images into the view; drop anchors at its world location.
A completed decode inserts one selected image in one undo action. It may be moved/resized/rotated,
selected partially, copied/cut/duplicated/deleted and included in transparent PNG exports. Explicit
«Обрезать изображения» keeps selected portions of affected images, removes their remainder,
preserves ink/other objects, and is one undoable action. Original image bytes remain immutable;
no automatic downsample/re-encoding. Raster images retain their original resolution constraints.
Mixed item order is preserved throughout all operations and backup roundtrips.

Allowed image payloads: PNG/JPEG file signatures and validated base64, no SVG/external URL or
arbitrary data URI. Limit8MiB binary/image,8192px/side,16million pixels/image; per board32MiB
binary total unique assets,32million pixels total and100unique assets. Existing64MiB JSON/item/
point/mask limits remain enforced. Validate headers/dimensions before decode and oriented decoded
size after decode. Corrupt/oversized data leaves scene unchanged with local feedback. Text fields,
UI overlays, modal, read-only and active input retain ownership of clipboard/drop/shortcuts.
Explicit clipboard-read fallback reports denial and preserves existing internal-fragment paste.
Once an image has been acquired, decoding and insertion continue across ordinary window blur
or hidden visibility. Temporary command busy state blocks new edits but incidental pointer
hover/move/up never cancels that command. Explicit cancellation/Esc, board replacement, blocking
dialog, write-authority loss and disposal abort its own pending transaction. Insertion reports
committed, cancelled or rejected with the precise localized reason; cancellation is not a bad-file
error. Late asynchronous results are bound to board/editor generation and disposed on switch/cancel.
Native generation-owned bitmap cache releases resources on disposal; no images/points in React.

**Portable schema4.** Read JSON1/2/3, write4. Persist discriminated items and a deduplicated embedded
asset table, items reference asset IDs. Runtime image items/clipboard/history share immutable assets.
Copy between boards carries its assets and resolves conflicting IDs without aliasing different bytes.
Strict decode rejects missing/conflicting assets, malformed matrices and all exceeded limits before
mutation. Store stays IndexedDBv1/documents; exact raw pre-schema4 and pre-library copies are atomic
and existing before-import/schema2/schema3 records stay untouched. Import replaces only active board;
export/recovery files remain self-contained. Recovery raw values retain existing corrupt-data rules.

**Worker boundaries.** Job root excludes items and assets. Geometry metadata discriminates ink
point sources from image natural bounds/asset IDs. Select/overview never retransmit encoded pixels.
Source/asset uploads use independent identity caches and bounded cancellable chunks; durable save
gets required payloads once, tied to immutable board ID. Worker rejects retargeting; close drains
writes/releases cache/repository. Main reconstructs selection results from original source identities.
PNG waits for image readiness, minimap uses transformed visible bounds without bitmap decoding.

**Board library.** One feature-owned library session holds existing origin-wide
penable:board:main Web Lock throughout workspace lifetime and owns catalog repository plus one
active DocumentSession. Board sessions borrow authority and cannot release the real lease; other
browser tabs retain existing read-only/reconnect semantics. First board remains ID/key main;
other IDs and backup keys are namespaced in the same store. Strict versioned catalog contains
IDs/titles/active ID, no scene data in React. Default migrated title «Моя доска»; trimmed titles1–80
characters, up to100boards. Existing main and legacy recovery are preserved; initial upgrade and
catalog creation commit atomically under the lease, with exact raw recovery. Corrupt catalog/main
is surfaced with recovery, never silently replaced with an empty library. Read-only legacy opens
without modifying storage.

Center-dock «Доски» control shows current title and opens a bounded nonmodal list with create,
rename and delete actions; no new home screen/router. New board has an independent blank document.
Delete requires a protected confirmation naming the board; the last board cannot be deleted.
Deleting active board preloads a valid successor before atomic catalog/document deletion. Each
board retains its scene/view/background/tools/writing anchor/backups. History resets on switch as
on reload; tab clipboard survives. Switching blocks input/late decode, requires flushOrThrow and
no dirty/error, validates target before closing current session, drains old worker, then hydrates
new generation and updates catalog active ID. Failure keeps current content and recovery available.
Do not infer success from existing flush() because it catches storage errors.

**Acceptance.** Preserve448unit cases/15E2E behavior and672native raster comparisons, adapting only
intentional schema/UI contracts. Add transformed partial clipping/thick edges/cancel/undo/PNG,
image decode/limits/file/drop/paste and bitmap cleanup; raw schema1–3 migration, per-board backups,
failed switch, delayed save/decode, catalog abort, cross-board clipboard and two-tab read-only.
Native browser desktop1440×900/1280×720 and390×844 checks cover central dock, focus, panels and
clear feedback. First3 valid fully warmed engine pairs use existing20%budget; ordinary input with
images/transform/minimap must avoid attributable>=50ms LongTasks. Explicit import/startup/decode
costs are measured separately. Final independent source/security/visual review and Full Gate precede
local ship. Physical Wacom and real OS clipboard remain the owner's final manual acceptance.
No release/deploy in this change without a separate instruction.

When a valid catalog references a missing or unreadable active board, Files offers read-only
recovery browsing of other catalog boards and JSON export of the displayed board. Preserve
the failed record's raw recovery and durable active ID. Viewing, navigation, switching previews
and closing recovery write nothing. A failed preview keeps the list accessible. The newest
selection owns the displayed result. Catalog failure retains its existing raw recovery flow.

## 5.17 Editor UX and unified clipboard (Change18)

Owner approved the Change18 plan: immediate visible image insertion, a left board library,
ordinary system clipboard between boards and a stable top dock. This refines5.16 without new
document/catalog schema, dependencies, routes or per-board transfer transactions. Ctrl+C/X,
switch board, Ctrl+V is the complete journey; no transfer picker/receipt/global undo.

**Images.** PNG/JPEG from the toolbar appears immediately after successful processing, centered
in the visible usable canvas area and fitted wholly inside it without enlargement. Select the
inserted image, retain transform handles and expose a concise move/resize hint. File/drop/paste
share validation/decode/commit. Show choosing/processing/success/error feedback in an accessible
out-of-flow area near the insertion trigger; native picker cancel returns to idle without an
error. Retry and choosing the same file twice work. Separate picker/change/cancel from window
blur: temporary focus loss cannot silently discard asynchronous file reading/decode/validation.
Esc, editor disposal/replacement and loss of writable authority cancel pending work safely.
Existing pointer gesture blur cancellation remains intact. Errors cannot change scene/history.
Insertion is atomic and undoable; one native event creates one item. Drop uses its world point.

**System clipboard.** One native adapter owns menu and Ctrl/Meta+C/X/V. Preserve editable ink,
partial-selection whitespace/masks, affine geometry and embedded images in a bounded strict
versioned Penable fragment payload; publish a PNG representation for external applications in
the same ClipboardItem where supported. Fragment codec belongs to board-document; entity
selection exposes pure capture/insert/remove primitives. Native browser/Blob/clipboard/raster
work stays in widget native owners. Reuse chunked jobs for heavy serialization/validation; no
large JSON/base64 conversion in a keyboard handler. Source/cut capture is generation guarded.

Clipboard input prefers a valid Penable representation, then PNG/JPEG. An invalid own format
shows an error rather than silently changing geometry. New external clipboard content must
never fall back to stale tab memory. Ordinary native paste can consume a PNG/JPEG File captured
synchronously from that same event when no own format is advertised and the async API is absent,
or its first successful read returns one or more items exposing no MIME types. Any exposed MIME
type suppresses this fallback. Native acquisition errors, retries, invalid own payloads and queued
paste never permit event-image fallback; its File is never retained as tab clipboard memory.
Native acquisition retries once on a transient read failure or opaque nonempty item collection;
menu Paste suggests Ctrl+V if the formats remain opaque. Explicit read denial fails closed
because Chrome may hide the editable representation behind that event's PNG. Permission, unsupported
format and empty feedback are explicit. See §5.29 for the later plain-text contract. Keep HTML/SVG/URL
ingestion out of this path,
background clipboard reads, permission bypass or automatic lossy vector fallback. Target is
current Chrome on Windows11/localhost or HTTPS. If editable write is unavailable, explain the
failure and retain the original. A cut removes source only after successful clipboard write
and source-removal validation; failed removal leaves a copied fragment and clear feedback.
Paste places a fragment at the current view center preserving relative world scale/order,
allocates safe IDs/lineage, deduplicates assets, validates before commit and selects the result.

Keyboard/menu clipboard use the same operation state and coarse busy/status projection, no
scene in React. Text inputs/dialogs keep native editing shortcuts. Repeated/pending/disposed
operations cannot double-insert or remove stale selections. Copy remains allowed read-only;
cut/paste remain guarded. Remove the duplicate Copy Image and Paste Image actions: ordinary
Copy/Paste perform format negotiation. PNG download directly exports a selected region without
requiring a previous copy. Single-board history retains its existing behavior: cut and paste
are separate ordinary undoable edits; switch/reload still establish the existing baseline.

**Library.** The dock chooser toggles a left out-of-flow sidebar with a heading/close control,
name search, create action, preview/name rows and per-row context menu (rename/delete). Show
active board clearly. Keep protected deletion/last-board guard, flush-or-fail switching and
per-board settings/recovery. Creation focuses a name field; default names avoid accidental
duplicates, explicit names retain existing80-character policy. Loading/empty/no-results/error,
busy/read-only/long names and keyboard focus paths are complete. Search is catalog-only and
does not load every board. Opening the sidebar never resizes/remounts/recenters the canvas;
other main panels replace it. It uses available screen height; narrow layout uses available
width beneath the dock. Preserve brand/lower navigation and the existing system type/Lucide.

The following preview contract is superseded by the color+icon covers in §5.18.
Previews were derived, not persisted: fixed256×160 or smaller raster, only visible rows, one
queued job at a time, bounded LRU (up to32previews/8MiB encoded) and placeholder on miss/error.
Feature owns catalog/document loading/cache lifetime; widget injects a narrow native thumbnail
render port rather than feature importing a widget. Do not eagerly decode100boards, create
full-size PNGs for downsizing, block writing or retain temporary decoded images/URLs. Render
last meaningful writing view when present, otherwise saved view/content fallback. Content
edit/import/delete invalidates that board's preview; close/dispose cancels pending jobs and
late results cannot attach to another board. Preview failure never prevents a document save.
Serialize/drain library-owned work before releasing the origin lease.

**Dock.** At widths>=1200 use a 730px centered dock with 128px board and 190px context slots,56px high, with fixed leading/tool/context/
status column allocation. At651–1199 use min(960px,viewport−24px), below branding, two stable
rows; at<=650 retain three stable rows with40px controls and viewport−24px width. Heights and
all permanent button positions stay invariant when switching Pen/Eraser/Selection or changing
board title/status. Context changes only inside its reserved area. Long names truncate; notices
and popovers remain out of flow. Narrow/short panels retain reachable final actions. Canvas
identity, viewport, backing allocation and note coordinates do not change from a disclosure.

**Acceptance.** Preserve524unit/31E2E behavioral coverage and672native raster comparisons. Add
native picker focus/cancel/retry and delayed decode cases; clipboard editable/mixed/partial,
cross-board/reload, external image, denial/unsupported/corrupt/large payload, stale selection,
single insertion and cut preservation; library lazy queue/LRU/disposal/failures/long titles and
dock geometry across tools at1440/1280/1000/768/650/390 and short screens. Native ordinary input
with a sidebar/thumbnail/image job must avoid attributable>=50ms tasks; explicit initial decode
is separate. Existing engine first3 valid warmed pairs and20% CPU budgets apply. Independent
source/security and bounded visual finish precede Full Gate and automatic local ship. Native
OS picker/clipboard and physical pen limits are reported honestly. No release without request.

## 5.18 Recognizable board covers (Change21)

Approved owner choices: color+icon covers replace sidebar thumbnails, assigned automatically
and manually configurable. Extend the incumbent light Operate editor, not toolbar or canvas.

**Covers.** Every board immediately displays a44×44 tonal cover with a22px Lucide icon,
8 colors (blue/teal/green/amber/orange/red/violet/pink) and16 symbols (notebook/book/calculator/
languages/flask/atom/code/briefcase/lightbulb/music/palette/globe/calendar/folder/graduation/pen).
Use stable allowlisted identifiers; no user HTML/CSS/icon names, uploaded art, emojis or new
package. Automatic assignment is deterministic from board identity and chooses an unused pair
among128 combinations for up to100boards. Persist explicit appearance; changing title/content
never reassigns it. Manual duplicates are allowed. Retain the named active-board treatment.

**Editor.** Row menu «Оформление» replaces sidebar list/search/create with an editor in the same
out-of-flow panel: board-specific heading/cover sample, color and icon radio groups, Save and
Cancel. Preview is draft-only. «Сохранить» commits then returns to the list; «Отмена» returns
without changes. Restore focus to that row's action button. Escape/close/outside dismisses the
sidebar and cancels unsaved draft, returning keyboard focus to the main trigger as applicable.
Errors stay inline with draft intact and retry available; busy/readonly guards remain immediate.
Use40px targets, visible focus, accessible Russian option names and selected markers in addition
to color. On narrow/short screens all choices/final actions remain reachable by scrolling; canvas
identity, bounds, viewport and history never change from editing appearance.

**Persistence.** BoardAppearance={color,icon} is board-library metadata; catalog schema2 carries
{id,title,appearance}. Read catalog1 compatibly, assigning stable unused covers. After validating
the selected board, the exclusive writer atomically preserves the exact original catalog in
before-library-v2 (never overwrite an existing backup) and writes catalog2. Readonly views derive
the same covers without any write. A failed migration leaves catalog/boards untouched. Unknown
or malformed appearance alone falls back to automatic without blocking access to writing;
structural catalog/id/title/version checks remain strict. Update appearance by board id through
the library owner and repository transaction; publish committed state only after success. Keep
IDB structure1, document schema4 and content JSON/clipboard formats unchanged; appearance is not
stroke undo history or part of content-only JSON import/export.

**Retire thumbnails.** Sidebar rendering uses catalog only and must not read every board,
launch loader/raster workers or allocate image/object URLs. Remove exclusively sidebar-owned
preview queues/cache/visibility/ports and obsolete jobs. Preserve shared PNG clipboard/export
and minimap rendering and their exact worker execution boundaries.

**Acceptance.** Test catalog1 migration/backup/abort/read-only,100 distinct automatic pairs,
manual duplicate/fallback, stable rename/reload and save/cancel/failure guards. Cover keyboard,
long names/short phone, no canvas/dock mutation and no thumbnail requests on100-board opening.
Native Chrome cold/warm sidebar and ordinary input must avoid attributable>=50ms main tasks.
Run Full Gate and local ship; release remains separate and owner hardware acceptance explicit.

## 5.19 — Writing instruments and vector templates (Change23)

Owner-approved extension, 2026-11-14. Keep the accepted floating UI, fixed dock dimensions per
breakpoint, two-layer raster budget, native per-sample ownership and exact fragment selection.
No new runtime dependency, router, drawing SDK or persistent catalog/IndexedDB structure change.

**Writing.** One writing-tool slot chooses pen (existing constant-width handwriting), pressure pen
or highlighter. Preserve legacy geometry exactly. Pressure pen uses actual recorded pressure for
variable thickness and exposes pressure strength independently of stabilization; mouse uses constant
width. Highlighter uses constant width, default20 (range4–64), opacity30% (range10–70%). One stroke's
self-overlap must not darken; distinct overlapping strokes may darken. Existing pen width0.5–12
and stabilization0–100 remain. Fix profiles at pointerdown; setting changes affect subsequent
strokes only. Re-render and commit use the same geometry without endpoint jumps or alpha seams.

Fixed palette only: existing dark ink, gray, blue, light blue, teal, green, yellow, orange, red,
violet. No custom color or user presets. Remember each instrument's settings in the board document;
legacy width/stabilization initialize constant pen. Toolbar shows color and width, with type,
stabilization, pressure or opacity in one nonmodal settings panel and a live stroke sample.
Tool changes must not resize the dock/canvas. UI keeps cached coarse projections, not raw scenes.

**Templates.** Add a single Figures and templates trigger. Figures: line segment, arrow,
rectangle, ellipse, triangle. Mathematics: number line, XY axes, unit trigonometric circle.
Configuration is available BEFORE placement only. Figures configure size, palette outline color,
width, solid/dashed stroke and optional palette fill for closed shapes. Number line/XY configure
range, tick step and numbers; XY also grid. Defaults−5…5, step1, numbers on, grid off. Circle uses
radians only, principal π/6 and π/4 angles and their multiples, coordinate axes and unit marks,
with angle-label/ray toggles. No degrees, point coordinates, formula parser or function graphs.
Preview must stay legible; invalid ranges/dense ticks explain the cause and disable placement.

Choosing a template arms a world-coordinate preview at the cursor. Default dimensions initially
fit the visible board with a maximum major dimension around320CSSpx. Explicitly edited dimensions
use board units at current zoom, shrinking only to fit the viewport and never enlarging a small
configured shape. The fit/configured choice is ephemeral placement state, not persisted metadata.
Show visible instruction “Нажмите на доску
для вставки · Esc — отмена”. A primary click places one item/undo action and selects it; Escape,
tool/board replacement, authority loss or disposal cancels safely. A click through UI never inserts.
Keep ordinary pan/zoom usable when armed, and preview placement consistent with the current view.

An inserted template is ONE vector item, with frozen validated configuration and generator version,
affine placement and local clip mask. It is not a bitmap or hundreds of independent strokes.
Pure entity-owned geometry/layout supports main/native PNG rendering, accurate bounds, minimap and
worker selection. Include labels in layout/bounds and redraw them at the current resolution.
Ordinary selection supports whole-object move/scale/rotate/copy/delete and exact partial clipping,
including labels. No post-insertion parameter editor or ungrouping. Whole-stroke eraser skips
templates like images. Cross-board copy remains the existing unified editable/PNG clipboard.

**Format and ownership.** Document schema5 reads1–4; first upgraded durable write atomically backs
up the exact previous raw board under a per-board before-schema5 key and exposes recovery download.
IDB1/catalog2 stay. Old editable fragments remain readable; new fragments carry schema5 content.
Do not reinterpret pressure on legacy strokes. Typed style/template data, geometry generation and
hit/bounds belong in entities/board; Canvas/placement/React composition in widget submodules;
strict codec, bounded worker transport and durable migration in board-document. Extend geometry
cache keys with style/profile, preserve weak ownership and ordered alpha compositing. Rejoining
same-source clipped pieces must not cause seams, double opacity or reorder intervening content.

**Acceptance.** Unit cases cover pressure/duplicates/dots/turns, active/commit equivalence,
highlighter self/cross overlaps, template math/layout/range limits, styles and mixed exact clipping.
Browser scenarios cover all tools/palette, cursor placement/cancellation, transformations/partial cut,
undo/redo/reload, schema1–4 upgrades/backup/abort/read-only, old/new clipboard and PNG. Cover keyboard,
focus, desktop/narrow/short viewport, stable dock and fresh console. Preserve existing raster suite;
run paired engine CPU checks and long mixed scenes without new attributable>=50ms ordinary tasks.
Full Gate and independent source/security/visual review precede automatic local ship; no release
in this change. Physical Wacom pressure/writing acceptance remains an explicit owner check.


## 5.20 — Compact writing and template controls (Change24)

Owner-approved 2026-11-14. Refine the current visual world; retain fixed dock dimensions,
two ink layers, native input ownership, instrument geometry and document5/generator1.

Writing uses one horizontal icon radio group, a compact live sample, a tightly packed fixed
palette and only the current instrument's sliders. Figures use a compact icon chooser grouped
into geometry and mathematics. Icons have accessible names and hover/focus hints; help also
opens by clicking. Palette circles have subtle highlight/shadow and a separate selection marker.
No custom colors/dependencies. Remove permanent instructional paragraphs from the panels.

Remove numeric width/height controls. Preserve click placement and default viewport-fit size;
insertion selects the item with existing resize handles. Outline width uses a0.5–12 slider
with0.5 step and numeric output. Only applicable fill/dash/math options are visible. Compact
preview is approximately100CSSpx high. At1280×720 and1440×900 primary panel controls and placement
fit without scrolling. Narrow/short displays may scroll but all actions remain reachable.
Opening tools/help never resizes the dock or drawing surface; one tool panel at a time.

Number-line/XY default to automatic tick spacing. A bounded pure helper recommends a valid
1/2/5×10^n step considering existing layout spacing, label lengths and tick-count limits.
Range bounds stay±10000, include zero and increase; existing schema validation stays strict.
Show effective step, allow manual mode initialized from it. A too-dense/sparse manual value
shows a concrete suggested-step action and disables placement while preserving the last valid
preview. Incomplete/invalid inputs keep their draft text and last valid preview, with errors
associated with the offending field and stale preview clearly distinguished. Auto/manual mode
and drafts are panel-local; only a concrete validated config is inserted/persisted. Changing
size after insertion scales that immutable template without regenerating ticks. Old items
and exported documents retain exact geometry; no migration or generator change.

Acceptance covers all instruments/templates/colors, sliders, icon/help keyboard access, invalid
drafts and preview retention, manual suggestion, automatic fractional/asymmetric/extreme ranges,
placement/resize/undo/redo/reload, existing document compatibility, responsive panels and fixed
dock geometry. Run native visual/console inspection, bounded UI performance checks, independent
review and Full Gate before automatic local ship. Release/Pages publishing is separate.


Change25 visual refinement: selected swatches use a soft blue tile and a small white check in
a blue badge instead of the dark outer ring. Keyboard focus remains a distinct blue outline.
Mathematical picker icons use installed Lucide MoveHorizontal/Move/Radius through EditorIcon
with the same22px size/2px stroke as neighboring tools; no bespoke tick-heavy SVGs.


## 5.21 — Touch, phone and tablet experience (Change26)

Owner-authorized2026-11-14; selected policy: fingers navigate bydefault, explicit finger-input
mode enables the selected editing tool. Target current Safari/iPadOS/iOS and Android Chrome,
including iPad+ApplePencil, tabletportrait/landscape and split-sized windows. Preserve the
current light visual language, toolbar invariance across tools, native ink geometry, document5/
generator1/catalog2/IDB1 and two-layer budget. No nativeapp/PWA/offline or Pencil proprietary
doubletap/squeeze API inthischange. Physical Pencil/palm/latency acceptance stays separate.

**Input.** Native PointerEvents own touch contacts outsideReact. One finger pans without ink,
two fingers translate+zoom around their midpoint, zoom25–800%. Rebase cleanly on1↔2 contacts;
thirdcontact cancels/quarantines the currentgesture until contacts lift. Only contacts begun
oncanvas belong to board; UI scrolling/sliders/text stay native. Finger-input mode is explicit,
transient workspace state (defaultoff, retained acrossboard switches, resets onreload). It
allows selected pen/eraser/selection tool with onefinger; touchink has constant pressure
response. Secondcontact cancels uncommitted finger edit before beginning navigation. Template
placement remains an explicit tap even in default navigation mode. Finger dragging transforms
uses a larger touch hit radius without changing saved geometry.

Pen haspriority: while stylus/other edit owns input, touches cannot change camera/ink; penbegin
cancels an active finger gesture/edit and quarantines already-down touches until lifted. A
secondtouch never cancels an active pen stroke. No claimofhardware palm recognition basedon
contactsize/deviceguessing. Preserve rawpressure/coalesced fallback and Wacom/mouse behavior.
Captureloss, pointercancel, blur, orientation/realresize, UIblocking, boardreplacement and
disposal cancel everygesture safely. Touch navigation is allowed readonly; edits are not.
Suspend/quarantine overlapping wheel streams and guard commands while gestureowns input.

**Responsive chrome.** Desktopfine ≥1200 keeps778×56 dock. Small/medium layouts no longer
reserve80px for a separatebrand row: hide decorativebrand and move dock near safe top edge.
Touch surfaces use44px primary targets and rangeheight, and >=16px textinputs to avoid Safari
autofocus zoom. Tabletlandscape uses a compact singlerow when itfits, portrait uses tworows;
phone retains a stable compact dock withalltools reachable. At320px only, an explicitly
scrollable primarystrip may overflowinternally; the page never scrollshorizontally. Keep
context/status/settings/navigation functions and accessible names, with no UA/device sniffing.

Coarse palettes use44px targets in twodense rows, tool/template pickers wrapwithout clipping,
and close/help/check labels are touchable. Phone settings/actions/library panels become
viewport-bounded sheets/drawers withtheir own scrolling and explicit close; tablet panels
remain contextual when spaceallows. Respect notch/homeindicator using viewport-fit=cover
and safe-area envinsets. Update overlay usableheight/bottom inset from visualViewport so
softkeyboard never hides focusedfields or finalactions; include cleanup. Orientation changes
preserve completed notes/camera and cancel only transientinput. Avoid canvas resizing merely
because a panel opens. Browser pagezoom remains available outside canvas; ownpinch zooms board.

**Acceptance.** Pure/native tests cover1/2touch anchor/rebase/clamps, cancellation/ownership,
penpriority/quarantine, touchmode and editingpermissions. Domainbrowser cases run inChromium
and PlaywrightWebKit for phones/tablets, rotation, realtap, synthetic multi-pointer streams,
pressure/cancel, pan/zoom/noaccidentalink, selectedtool editing/resize, safearea/keyboard
geometry and reload. Synthetic events/emulation/WebKitLinux are not real iPad hardware proof.
Preserve desktopregressions, paired native engine CPU/raster budgets and bounded gesture input.
Independent review and Full Gate precede automatic localship; publication remains separate.

## 5.22 — Readable mathematical templates (Change27)

Approved2026-11-14. New number lines, XY axes and trigonometric circles use generator2;
existing generator1 items retain exact appearance/geometry, including clipped fragments.
Schema5/catalog2/IDB1 remain unchanged; support generator1|2 and reject unknown versions.
Every layout/bounds/selection/render/export/codec/cache/source-compatibility path dispatches
by actual generatorVersion. No automatic old-item conversion or data mutation.

Numeric templates compute dimensions from actual label metrics and tick count; every chosen
step/tick label is retained, no thinning or silently changing a manualstep. Required step1
examples0…15,0…100,−100…100. Equal XY unit scale. Limit201ticks/axis and32768local units/side;
keep finite±10000 range includingzero and step>=.000001. Count/size validated before enumeration.
Invalid drafts retain lastvalid preview and actionable error. No numeric size controls.
New math placement uses readable current-view lettering, without320px viewport-fit reduction;
large figures may extend beyondviewport. Numericv2 placement anchors zero/origin at the clicked
point (circlecenter forcircles), keeping positive-range axes visible; normal/v1 placement remains unchanged.

Handwriting uses compact prepared KleeOneRegular vector glyph outlines/metrics for required
numeric/x/y/pi/minus/separator characters, with upstream source provenance and OFLlicense.
No full font, network font loading or newruntime dependency. Same glyphs and metrics feedSVG,
Canvas andPNG; no textLength glyphstretch or fillText widthcompression for generator2.
Pure generator owns glyph metrics, bounded layout, label bounds and caching; native painting
stayswidget/PNGworker-owned. New label primitive retains semantic text and bounds for selection.

XY has one origin0 lowerleft of axisintersection; all labels clear axes/ticks and neighbors.
Circle angles remain radians outside, ±1 coordinates inside, axis names preserved; no extra
coordinatezero. Independent Angles/Coordinates toggles defaulton, backedby labels/numbers in
version2 only. Labels avoid axes/circle/otherlabels even with rays. Preserve version1 behavior.

Math panel >=760px uses up to640px two-column preview/settings, phone onecolumn. Preview heights:
numberline120px; XY/circle240px wide/180px narrow. Uniform aspect ratio. Default Whole mode fits the complete figure; Closeup aroundzero is
explicitly selected when needed. Both modes support pointer/touch panning. Preview camera is local,
never changes board camera/history/document. Accessible buttons Крупно/Целиком and keyboard
pan; touch44px controls, safeareas/keyboard viewport fitting remain. Bounded internal scrolling
on short/narrow screens, desktop1280×720 primary controls reachable without long vertical lists.

Acceptance includes pure limits/tickcount/nonoverlap/glyphmetrics/legacy invariance, Chromium+
WebKit responsive preview/input, nativevisual desktop/phone/tablet, versionedcodec/JSON/clipboard/
PNG/history/reload/exactselection tests, worstcase math CPU/raster and unchangedink budgets.
Independent review and Fast/Full gates precede automatic localship. Publication separate.

## 5.23 — Installation and offline use (Change31)

Owner-requested2026-11-15. Supersedes earlier PWA/offline exclusions only. After one complete
online preparation, production builds can reopen offline on the same origin/profile, including
all lazy document/selection/overview/export workers. Existing IndexedDB, leases, backups and
schemas remain unchanged. No account, cloud sync or native wrapper. Installation is optional;
offline also works in a browser tab. First visit requires internet and browser storage retention.

A base-aware manifest provides stable id/start_url/scope, standalone display, Russian naming,
local192/512px icons and Apple touch icon. Scope stays inside the build base (/penable/ on Pages).
Production-only service worker precaches the complete immutable app shell atomically with a
build-content version; failure must not mark offline ready or replace a working version. Fetch
only scoped same-origin GET app resources; never cache documents/user files/external requests.
No skipWaiting, forced reload or clients.claim: open sessions keep their version; updates take
effect after all app windows close and reopen. Old caches belonging to this app/scope only may
be cleaned upon safe activation; never clear IndexedDB or unrelated caches. Dev has no SW.

Compact contextual application controls preserve the approved editor/dock layout. Show accurate
preparing/ready/unavailable offline status, update waiting guidance and optional native install
action only when browser offers it. Explain manual browser installation including iPad Share →
Add to Home Screen; no UA guessing or promise of native prompt support everywhere. Installed
standalone mode hides redundant install action. Failed setup does not block writing/saving.
Provide explicit retry and no unhandled registration/prompt errors. Native APIs belong to one
exact adapter, lifecycle cleanup and coarse subscriptions only; no editor/input changes.

Acceptance: root and Pages manifest/base/cache paths; online preparation then offline reload,
writing/save/reload and lazy operations; install availability/dismissal/installed state; waiting
update leaves open notes intact, then safe activation on fresh session; failed install retains
old version and notes; scoped cleanup ignores unrelated caches. Chromium automated regression,
native Chrome desktop/phone visual/console evidence and Full Gate/review precede local ship.
OS-level installation and physical iPad home-screen behavior remain manual acceptance. Release
and public-site deployment require separate instruction.

## 5.24 — Compact intermediate toolbar (Change32)

Owner-requested2026-11-15 from installed-app screenshot. Supersedes fine-pointer dock breakpoints
in prior sections: use the existing778×56 single row at widths>=900px. At651–899px use two rows,
104px high, cap width at778px and center when it fits; otherwise retain12px safe side clearance.
At<=650px retain existing three-row152px fine-pointer behavior. Brand remains hidden below1200px;
the safe top offset and touch814×60/112/164 layouts remain. Keep controls/content, fixed slots,
tool-switch geometry invariance and drawing surface unchanged. Test both sides of900/650px and
intermediate1000/1199px, desktop, phone and coarse input; retain keyboard/target accessibility.

## 5.25 — Dense compact toolbar composition (Change33)

Owner-requested2026-11-15 after two annotated screenshots reject remaining whitespace in Change32.
Supersedes earlier dock breakpoints/composition. Fine pointer: single778×56 at viewport
width>=802; otherwise two dense rows383×104 at>=407, three rows286×152 below407. Coarse pointer:
single814×60 at>=838, dense two rows399×112 at>=423, three rows294×164 below423.
These viewport examples assume12px side clearance; choose actual modes via a full-viewport
query frame whose content width excludes both safe insets (single778/814, medium383/399). Clamp
the smallest dock to usable width down to280px without reducing targets; context may narrow
and selection label padding reduces in that case. Bound all modes
to safe viewport edges, preserve top safe inset and hide decorative brand below1200 as before.

Medium rows: [board chooser, five editing controls] / [history, context, save/settings]. Small rows:
[board chooser, save/settings] / [five editing controls] / [context, history]. Board chooser stays
128px, including long-name ellipsis; never expands into a full-width blank header. Context reserves
178px in compact modes (narrowing only below294px usable width) and preserves pen/eraser/selection geometry; thickness fills that width
instead of the prior104px phone rule. History becomes a separate layout item; keep native tab order,
no duplicated controls, no new interactions or state. Fine40/coarse44px minimum targets remain.
Compact columns/rows stay fixed across selected tools and panel opening; never resize the canvas.

Acceptance checks actual useful group bounds/density, not only tool-switch invariance. Cover320,
390,406/407,422/423,600,650,768,801/802,830,837/838,899/900,1000,1440; fine/coarse, all tools,
long names, native keyboard/focus and fresh console; retain existing browser regressions. Local
ship follows Full Gate and independent review; publication remains separate.

## 5.26 — Pen release and calm writing feedback (Change34)

Owner-requested2026-11-15: Wacom One sometimes shows a short cursor displacement on pen lift,
and toolbar disabled styling flashes on repeated handwriting. Treat the reported hardware cause
as unconfirmed until owner reproduction; repair the concrete presentation path and test it.

For pen pointerup, retain the last accepted move/down cursor sample rather than consuming the
terminal event's potentially unreliable position. Do the same for an active pen contact's first
buttons-loss move; preserve existing ink handling/cancellation. The next genuine hover/move
updates normally. Mouse release retains normal sampling; foreign active pointers/cancel/blur/UI
ownership remain. No delay, distance cap, prediction, raw-data filtering or document change.

Toolbar controls temporarily unavailable because of existing interaction/job busy state keep
their prior ordinary/selected visual colors while native disabled semantics and all immediate
command guards remain. A reusable Button transientDisabled input represents this independently
of intrinsic disabled(readonly/no undo/redo); intrinsic unavailability still takes precedence and
uses standard muted styling. No CSS transition from a stroke should fade the whole toolbar.
Existing save status remains the feedback for persistence; processing/error/readonly feedback
stays explicit. Preserve revision-aware background autosave and blocking import/replacement;
do not add a global save lock or weaken existing barriers. Controls recover after input ends.

Acceptance covers pen lift/missing-button event order, next hover, mouse/other pointers and
unchanged geometry; repeated handwriting computed styles/layout; blocked buttons and command
recovery; intrinsically disabled/readonly behavior; normal save/reload and existing touch modes.
Physical Wacom acceptance remains an owner check. Full Gate/review precede immediate local ship;
release is separate.


## 5.27 — Application language (Change36)

The owner-approved 2026-11-15 repository plan adds complete English/Russian UI. Resolve language
before first render: saved explicit en/ru, otherwise the first supported base language in ordered
browser preferences, otherwise en. The existing gear View section offers Auto / English / Русский.
Auto removes the explicit preference and follows browser changes. Preference is application-wide,
profile/origin-local, separate from board JSON and usable in readonly. Denied preference storage
must not block startup or an in-memory switch. Locale listeners are lifecycle-owned and disposed.

Bundle both typed i18next/react-i18next resources with the offline shell; no remote translation
backend/detector or account. Switching is immediate without editor remount, board write, scene
conversion or history/selection loss. All controls, hints, aria names, dialogs, statuses, diagnostics,
error paths and document metadata follow the active language. Static shell/manifest use English.
Domain/Worker errors preserve stable code+parameters through transport/catches; translation occurs
at presentation so an already-visible message changes language too. Workers/entities remain
React/browser/i18next-free. Unknown native technical details may remain as supplied by the browser.

Generated new board titles use the current language; existing titles/content are never renamed.
Keep format5/catalog2/IDB1 unchanged. Test locale precedence/normalization, invalid/denied storage,
Auto/manual/reload/offline, current error translation, readonly control access, narrow layout,
keyboard focus and exact content/history preservation. Original behavioral E2E use explicit RU;
locale-specific acceptance covers EN and RU. Hardware writing/OS installation remains separate.

## 5.28 — Application and board themes (Change45)

The owner-approved theme plan adds Light / Dark / System in Board settings → View, beside
Language. Light remains the default, including after upgrade. One origin/profile preference
applies to all boards and application chrome; it is independent of document data and writable
authority. System follows prefers-color-scheme changes only while selected. Resolve before the
first application render; synchronize preference changes between tabs. Storage denial preserves
an in-memory choice with a localized notice. All listeners are lifecycle-owned and disposed.

Display uses paired variants of the existing ten-color ink palette: dark primary ink becomes
light, while deliberate blue/red/other hues retain their identity with suitable brightness.
The same pure color resolution serves ordinary/pressure ink, highlighter, template outlines,
fills, labels and SVG/tool previews. Preserve opacity, widths, geometry and compositing order.
Theme paper, grid/dots, cursor/selection, minimap and all controls/dialog states consistently.
Photographs/screenshots retain their original pixels, including any text embedded in them.
Do not apply an inversion filter to the whole board. Preserve current layout and light raster.

Theme changes invalidate completed/live raster paint state and redraw existing geometry without
remounting the editor, cancelling active ink, changing selection/camera/history, traversing raw
points for color conversion, or writing the board. Subsequent drawing stores the original palette
color. Documents, editable clipboard fragments, imports and recovery copies retain original colors.
PNG download and clipboard PNG explicitly retain light-theme colors and transparent background.
Keep document5/catalog2/IDB1 and dependencies unchanged; no schema migration or board metadata.

Verify palette/instruments/templates/images, exact light→dark→light raster and data preservation,
active input/selection/history, system/manual/reload/cross-tab/offline/readonly and storage failure,
PNG equality across themes, narrow keyboard/focus/contrast and native large-board repaint/input
cost. Physical Wacom/Pencil and GPU-specific acceptance remains separate from synthetic tests.

## 5.29 — Editable clipboard text (Change47)

Paste plain text with the system shortcut or Actions → Paste. Preserve paragraph breaks and
characters, wrap to the usable viewport, and select the result. The beginning of tall text stays
visible. An explicitly text-only system paste consumes its event text synchronously. Other
requests negotiate editable Penable, PNG/JPEG, then plain text. HTML is never interpreted.
Permission errors in the menu explain the system paste path. A text-bearing selection above
raster limits can still be copied or cut as an editable fragment. A paste queued behind an
in-flight Penable copy reads that copy after the write completes.

In Selection mode, a click or tap on text selects its whole block. A region includes a text block
when it encloses the block. Existing transforms, copy, duplicate, delete and PNG apply to text.
Edit text opens a localized textarea with Save and Cancel. One successful save is one undoable
change. Pen and highlighter annotations are separate items and can travel in a shared selection.

Ordered text objects store plain text, width, visual line starts and affine placement. The same
Canvas painter serves the board and light-compatible PNG. Limit a block to 8,000 UTF-16 code
units and 256 visual lines, and a document to 1 MiB of UTF-8 text. Empty or oversized input
leaves the board intact. Text-bearing snapshots use document6; text-free snapshots use document5.
Read schemas1–6 and keep the exact previous durable record on the first transition to document6.
Catalog2, IndexedDB1 and the editable clipboard envelope retain their existing formats.

## 6. Auth & Access Model

No authentication. Access follows computer/browser-profile access. Historical M1 was tab memory;
M3 and current storage are origin/profile-scoped and not automatically synchronized. Site-data
clearing may delete notes; persistent-storage permission cannot replace a downloaded backup.

## 7. Infrastructure and Deploy/CI

### 7.1 Local development

Vite SPA without SSR/Docker/external services. Node/npm run in WSL and lockfile pins dependencies.
The guide explains WSL launch and ordinary Windows Chrome on localhost. Dev server is loopback-only;
do not expose it to the network unnecessarily.

### 7.2 Verification and publication

Automated checks cover logic/build; Playwriter covers UI/console; the owner checks physical tablet
behavior. The owner authorized initial GitHub/Pages publication in Change07: public
`avatarsik6699/penable`, preserved Git history and static assets at
`https://avatarsik6699.github.io/penable/`. Current delivery is local unless release is requested.

Actions checks PR/main: lint/architecture/format/types/unit/dependency audit/Pages build and isolated
browser tests. Only successful main can deploy through github-pages; official actions are SHA-pinned.
Local Full Gate and history secrets scan precede ship --release. Verify the exact run/deployment and
live page, never infer current production from a local commit. Dev/build use `/`, Pages uses `/penable/`.

Strokes remain in browser IDB, never GitHub. HTTPS/localhost are separate origins; transfer by JSON
export/import. Pages controls HTTP headers; there is no app API or custom response-header server.
Offline availability was added in §5.23; IndexedDB alone does not load application assets offline.

## 8. Non-Functional Requirements

| Area | Criterion / limitation |
|------|------------------------|
| Writing | Dots/final segment visible; hover/cancel cannot leave stuck input. Owner judges comfort |
| Performance | No per-point React render. One active path on a separate layer at most once per RAF; no completed-scene traversal per point. No universal latency/scene-size promise |
| Clarity | Change02: DPR1/2, own zoom100/200/400%, page zoom/native pinch; geometry redraw, seam/live-commit parity. Disclose bitmap limits and unverified hardware |
| Accessibility | Labeled keyboard controls, visible focus and textual status. Handwriting semantic equivalent/formal WCAG audit were outside M1 |
| Security headers / CORS | Local assets, no app API; API CORS inapplicable. HTTPS/headers supplied by Pages, no custom response server |
| Privacy / observability | No analytics, stroke uploads or content logging; input diagnostics stay local |
| Backup / restore | M1 explicitly did not save. M3/current app require editable copies and restore verification |
| Errors | Explain unavailable Canvas; write failure cannot appear saved, and completed memory remains exportable |
| Evidence | Synthetic pen cannot confirm hardware; screenshots/green tests do not replace device checks |
| Dependencies | Minimal dependencies/lockfile; mandatory secrets and dependency checks before ship |
| Compliance / SLO | No additional brief requirements; do not invent guarantees |

## 9. Roadmap

### Original milestones — historical

| Stage | Outcome | Acceptance boundary |
|-------|---------|---------------------|
| M1 | Input proof, Change01 | Automated/browser checks and explicit owner tablet result; fix observed input issues |
| M2 | Change02 quality/navigation, then backgrounds/history | Clear zoom, no seams/unwanted ink/drift, physical writing assessment |
| M3 | Storage/backups | Reload, write failures, export/import round-trip |
| M4 | Eraser/UX/exact selection, Change08 | Geometry/save/selection checks and owner trial |

Original schedule estimates were preliminary, not commitments. Later §5 contracts record delivered
work through Change34; local ship and public release are distinct.

### Repository presentation and language

The 2026-11-15 repository plan authorizes English documentation, the ru/en interface in §5.27 and
an English visual README. Application language is separate from document data; both dictionaries
are bundled for offline use. The visual README will demonstrate actual available behavior.

Public future capability checklist, without delivery-date commitments:

- [ ] PDF import, annotation and export.
- [ ] Partial-stroke eraser.
- [ ] Optional cloud synchronization.
- [ ] Handwriting recognition (OCR).

These four directions are positioning/roadmap intent only. They do not authorize backend, account,
network-upload or recognition implementation in documentation/localization changes. Future contracts
must preserve an explicit distinction between local storage and optional network services.

## 10. Out of Scope

The original first-three-stage exclusions were collaboration, accounts, cloud/backend, recognition,
shapes/stickers/plugins/mobile gestures/WebGL/PDF/PWA/multiple notebooks. They are historical:
Change05 added erasure,08 selection/PNG,17 transforms/images/boards,23 instruments/templates,
26 touch and31 offline availability. PDF/partial eraser/optional cloud/OCR are planned, not delivered.
New implementations require their own approved Backlog/change rather than assumptions from a checkbox.

## 11. Open Questions

- M1 Wacom One/Windows11, writing, pen/mouse and changing pressure were owner-confirmed.
  Missing browser/driver versions limit diagnostics; do not repeat accepted checks without cause.
- SPEC and /work01 were approved2026-11-12.
- Change02 clear board navigation/geometry was authorized; backgrounds/history followed in M2.
- Change04 format/limits/session history/close/multi-tab behavior is in §5.6.
- Change05 whole-stroke erasure was authorized with «Продолжай по плану» (“Continue according to
  the plan”); contract §5.7.
- Change07 GitHub/Pages was authorized; stable origin/CI are in §7.2. Later releases remain separate.
- Physical iPad/Pencil, OS install and later Wacom driver behavior need scenario-specific acceptance;
  do not infer it from automated checks or earlier handwriting approval.

## Technical sources

Checked2026-11-12; React/Vite were also queried through Context7. These sources describe platforms,
not acceptance of a particular device.

- [Wacom: Pointer Events](https://developer-docs.wacom.com/docs/icbt/web/web-api-basics/).
- [W3C Pointer Events](https://www.w3.org/TR/pointerevents/): capture, cancellation, coalesced events.
- [React useRef](https://react.dev/reference/react/useRef) and [useEffect](https://react.dev/reference/react/useEffect): imperative integration/cleanup.
- [Vite Getting Started](https://vite.dev/guide/): client React/TypeScript setup.
- [MDN: storage quotas and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
