# penable user and developer guide

A personal handwriting workspace for study notes, math and explanations. The main confirmed input
setup is Wacom One on Windows 11. Write on a free board with configurable pens, precise fragment
selection, mathematical templates, navigation and browser-local storage.

[Open penable](https://avatarsik6699.github.io/penable/) ·
[Product overview](../README.md) · [Repository](https://github.com/avatarsik6699/penable)

**Notes live in this browser profile. Download editable JSON copies to protect them against
site-data clearing. There is no cloud backup or device synchronization.**

This guide describes the repository build. Public Pages updates use a separate release;
local delivery alone does not establish which revision the public site runs.

## Interface language

On first launch, penable chooses the first supported language in your browser preferences,
falling back to English. Board settings → View → Language offers Auto, English and Русский.

Board settings → View → Theme offers Light, Dark and System. Light is the default; System
follows your device's color scheme. This preference applies to all boards and menus in this
browser, including read-only tabs, and is remembered separately from your notes.
Existing handwriting, colored ink, shapes and mathematical labels adapt to the background.
Photos and screenshots keep their original colors. Switching back restores the light appearance;
the stored colors and undo history stay intact. PNG downloads and image copies always use the
original colors for a light background with transparency, regardless of the selected theme.
A manual choice is saved for all boards in this browser profile; Auto follows the browser.
Switching applies immediately and preserves notes, selection and undo history. Existing board
names are never translated. Both languages are included in the prepared offline app.

## Open and install

Open **https://avatarsik6699.github.io/penable/** in Chrome. An account and installation are
unnecessary. Pages serves application assets; notes remain in browser IndexedDB and are not sent
to the repository.

Localhost and the public site have separate storage. To transfer a board:

1. On the old address, wait for saved status and download JSON through Board settings
   («Настройки доски») → Files and copies («Файлы и копии»).
2. On the destination, choose Import («Импорт»), select the JSON and confirm replacement.
3. Wait for Saved («Сохранено»). Keep the downloaded file as a backup.

The production build includes installation and offline availability from Change31. Open App and
offline («Приложение и офлайн») beside Help and wait for Ready to work offline
(«Готово к работе без интернета»). Then the board can close/reopen without network access. The
first load and complete preparation require internet; installation itself is optional for offline use.

Chrome/Edge may offer Install penable («Установить penable») in the app or browser menu.
On iPad/iPhone, use Share → Add to Home Screen. OS installation and standalone behavior depend
on browser/device support; physical iPad home-screen and OS-install acceptance remain separate.
Installing does not create cloud storage. Different devices/profiles may contain different notes.

Updates do not reload an active board. When Update ready («Обновление готово») appears, wait
for saved status, close every penable tab/window, then reopen. Site-data clearing can delete both
notes and offline assets. Keep JSON copies of important boards.

## Run locally

All terminal commands in this guide run from the repository root.

Use Node.js 22.12+ within Node.js 22, Node.js 24 or 26+, plus npm. The recorded development environment is
Node.js 24.21.0 / npm 11.19.0. In WSL, from the repository root:

```bash
npm ci
npm run dev
```

Open **http://localhost:5173** in ordinary Windows Chrome, with the Wacom driver installed on
Windows. No backend, Docker, account or access keys are needed. The server listens on 127.0.0.1
and fails if the port is occupied. Stop it with Ctrl+C in its terminal.

## Navigate and write

- Two-finger scrolling or a normal wheel pans both axes over the board. Ctrl+wheel/trackpad pinch
  zooms around the pointer; Shift+vertical wheel pans horizontally. Elsewhere the browser behaves normally.
- Space+primary drag or middle-button drag pans. −/+ zoom around the center; the percentage button
  sets 100% while retaining the current view center.
- Return to writing («К месту письма») restores the last completed pen view. Minimap («Миникарта»)
  opens the overview: click to reposition at the same zoom, or use focused arrow keys. Fit all
  («Показать все записи») is inside the minimap.
- Board zoom is 25–800%. Width is in board units and scales with the view. Active ink blocks own
  pan/zoom; real resize/resolution changes cancel unfinished ink while retaining completed notes.
- Wheel/inertia overlapping ink/erase/drag is ignored until 150 ms quiet so release cannot move notes.
- Writing settings offer constant-width Pen («Ручка»), Pressure pen («Перо с нажимом») and
  Highlighter («Маркер»). The pressure pen uses pen pressure; mouse input stays constant-width.
  A highlighter stroke is translucent and does not darken at its own crossings.
- Tools float at the top. Width is beside the selected pen; clicking Pen again opens settings.
  Help/diagnostics are lower-left; zoom/navigation lower-right. Escape closes a panel and returns focus.
- Pen width 0.5–12 px, slider step 0.1, default 3. Stabilization 0–100%, step 1, default 65%; 0 disables,
  50 matches legacy light and 100 legacy strong. Both affect the next stroke; existing geometry and
  raw samples remain intact.
- Undo/redo controls and Ctrl+Z/Ctrl+Shift+Z reverse completed actions. Physical KeyZ works on a
  Russian keyboard layout; Meta is equivalent to Ctrl. Ink/pan blocks history; text fields retain
  native browser undo.
- New completed ink/nonempty erasure clears redo. Cancelled input, navigation, pen settings and
  backgrounds preserve it.
- Board settings → View («Вид») chooses Blank/Dots/Grid. The world-anchored pattern moves with
  content and becomes coarser when zoomed out; changing it does not affect ink/history.

## Colors and templates

Click the selected Pen again for instrument choice, ten colors and settings. Each instrument keeps
its settings for subsequent strokes. Pressure strength belongs to the pressure pen; opacity to the
highlighter, default width 20 / opacity 30%. Physical feel of these later tools requires a Wacom trial.

Shapes and templates («Фигуры и заготовки») offers line, arrow, rectangle, ellipse, triangle,
number line, XY axes and a trigonometric circle with radians. Configure before insertion, then
choose Place on board («Разместить на доске»). Preview follows the pointer; click commits,
Esc cancels. The inserted template is selected for move/resize/rotate/partial selection or copying
between boards. The whole-stroke eraser does not erase templates.

Current JSON is format 5 and reads 1–4. The first upgrade retains the original record separately,
accessible in Files and copies.

## Select and move

Choose Selection («Выделение») and Rectangle («Рамка») or Lasso («Лассо»), then surround an
area. Selection clips the painted content at the boundary, including crossing-stroke fragments.
The outline retains the drawn area and empty margins. Drag anywhere inside to move the frozen
selection; underlying/unselected content is not adopted. Lasso keeps its shape. Copy/paste retain
region size/margins. Actions («Действия») contains copy/cut/paste/delete/duplicate. Holding near
an edge auto-pans; Fit all returns to distant content. An empty region creates no content.

| Shortcut | Action |
|----------|--------|
| Ctrl+A / Esc | Select all / dismiss or cancel an unfinished move |
| Ctrl+C / X / V | Copy/cut/paste through the system clipboard |
| Ctrl+D | Duplicate with a small offset |
| Delete / Backspace | Delete selection |
| Arrows / Shift+arrows | Nudge 1 / 10 screen pixels |
| Ctrl+Z / Ctrl+Shift+Z | Undo/redo one completed action |

Meta replaces Ctrl. Board shortcuts leave text fields/dialogs intact. Clipboard handwriting remains
editable between penable boards, including after reload until the external clipboard changes.
Paste centers/selects the result; moving between boards is Ctrl+X → switch board → Ctrl+V.

Copy also provides a PNG for external apps, with transparent margins and no dots/grid/outline.
Actions → Download PNG («Скачать PNG») exports the selected area directly. Vector-derived output
uses 2 pixels per world unit, maximum 8192 pixels per side / 16,777,216 total pixels. Reduce oversize regions; there is no
silent quality reduction. Heavy work may run in the background and Esc cancels it. At 20k fragments,
moving part of a stroke may exceed the item limit; select whole strokes or remove unneeded content.
Failures preserve content. Read-only permits selection/copy, not mutation/deletion.

## Resize and rotate

Rectangle/lasso selections have side/corner resize handles and a round rotation handle above.
Shift preserves aspect ratio or snaps rotation to 15°. The opposite side stays anchored. Esc cancels
an unfinished transform; completed transforms support undo. Actions → Transform («Преобразовать»)
accepts width/height percentages and degrees. Handwriting remains vector content; width scales with it.

## Erase

- Choose Eraser («Ластик») and touch/sweep ink: hit strokes disappear whole. After clipping,
  only the hit visible fragment is removed; distant siblings survive, including after reload.
- One down→up is one undo action covering every hit. Undo restores all; redo removes them again.
- Removal is preview-only until release. Cancel/blur/capture loss/resize restores content;
  save/export during preview still includes original ink.
- Target radius is 8 screen pixels at every zoom. Pen width/stabilization do not alter it and are
  retained when returning to Pen.
- Misses/tool switching preserve redo. During contact, switching/navigation/history/import are
  blocked. At rest Space/middle pan works with Eraser selected.
- Initial load/import selects Pen. Hardware Wacom buttons, partial-stroke erasure and adjustable
  eraser size are not implemented. Partial selection is a separate way to edit fragments.

## Paste and edit text

Copy a passage from a book or article and paste with Ctrl+V, Cmd+V, or Actions → Paste
(«Действия → Вставить»). The board keeps the paragraphs and wraps long lines. Switch to
Pen or Highlighter to annotate it. Enclose the whole block and your marks in one rectangle
or lasso to move them together.

In Selection mode, click or tap the block and use Actions → Edit text («Изменить текст»).
Save applies the change in one undoable step. Copy the whole block to another board or use
Download PNG for a shareable excerpt. Large selections containing text can still be copied
between boards when they exceed the PNG limit. A JSON backup retains editable text and strokes.

## Images

Insert image («Вставить изображение») opens PNG/JPEG. Files can also be dropped onto the board
or pasted while it has focus. File/clipboard insertion is view-centered; drop uses its location.
The result is selected. Paste accepts editable penable fragments, images and plain text. Cut preserves
the original if clipboard writing fails. A new external clipboard never silently falls back to an old internal copy. If the browser
cannot distinguish editable content from image content, preserve data and explain the refusal.

Images/ink can be jointly selected, moved, resized, rotated, copied and deleted. Crop images
(«Обрезать изображения») retains affected portions inside the region, preserving other ink;
partial selection/move can also cut fragments. Undo restores originals. Eraser affects ink only;
use selection to delete images. PNG includes images/transparency; image source resolution is retained.

Limits: PNG/JPEG ≤ 8 MiB, 8192 pixels per side / 16 million pixels each; up to 100 unique sources, 32 MiB of bytes and 32 million pixels
per board. Copies share source bytes in JSON. SVG/URLs are not loaded; invalid files preserve notes.

## Boards and appearance

Boards («Доски») and current title at the start of the dock open a searchable sidebar with colored
covers and New board («Новая доска»). Row actions change appearance, rename or delete; clicking a
row opens it. Every board keeps its content/images/view/background/tools/recovery copies. Switching
drains saves first and stays on the current board on failure. The library does not load board scenes
or render thumbnails just to show the list.

Deletion names the board in a confirmation and removes its local recovery copies too. The last board
cannot be deleted. Switching starts fresh session history; clipboard fragments can cross boards.
One origin/profile has one writer tab; others remain read-only. A legacy single board migrates as
My board («Моя доска») with content preserved.

Colors/icons are assigned independently of content and remain stable through renaming/editing.
Row … → Appearance («Оформление») opens a draft editor. Save appearance («Сохранить оформление»)
commits; Cancel («Отмена») or dismissal discards the draft. Appearance is library metadata, not part
of an ordinary board JSON backup. Dock width/control placement stays stable between tools; compact
screens use a persistent multirow composition.

## Save, restore and storage boundaries

Tools, save status and Board settings share the top-center dock. Green means locally saved, yellow
pending changes, gray loading/read-only and red an error with visible explanation. Hover/open status
for details; Board settings → Files and copies contains recovery actions.

- Writing/history/view changes autosave. Wait for Saved locally («Сохранено локально») before closing.
  Unfinished ink is not saved. A crash/forced process exit may lose the latest unsaved action.
- Write failures preserve memory for retry and Download copy («Скачать копию»). That JSON includes
  current completed unsaved content. Verify the file reached the browser's downloads.
- Import validates and shows statistics. Only Replace board («Заменить доску») mutates content;
  cancel/invalid files preserve it. Successful replacement retains one previous copy. Copy before
  replacement («Копия до замены») survives reload and can be imported normally; the next confirmed
  replacement overwrites that single snapshot.
- Other tabs are read-only. Close the writer and choose Retry connection («Повторить подключение»)
  to reload the latest saved content before editing.

Keep one address, **http://localhost:5173**. A different host/port, including127.0.0.1:5173 or4173,
is a different storage origin. Browser profiles/devices are separate too. Clearing site/profile data
can delete notes. Writing requires Web Locks; Chrome is the main target. Offline boot requires the
prepared production shell; there is no cross-device synchronization.

The `penable-board` format uses schema 6 when a board contains text and schema 5 otherwise: ordered items, deduplicated image assets,
styled ink/vector templates, viewport, background/tools/background settings and last-writing view.
Older JSON 1–5 remain readable; transforms do not overwrite raw ink samples. The first write upgrading
an older board to 5 atomically retains its exact old record as `before-schema5` if no such copy exists,
downloadable as `penable-before-schema5.json`. The first write of a text-bearing board preserves the
previous record in `penable-before-schema6.json`. Older library/schema 2/3/4 recovery copies remain
separate. Import replaces only the current board; its JSON includes required image bytes. Older
applications may reject format 5; use recovery copies when returning to an older version.

Document guards: 64 MiB JSON, 20k items, 1M total points, 100k points per stroke. These are safety limits, not near-limit
performance promises. No truncation: save/import fail explicitly; complete in-memory export remains
available with a warning if reimport exceeds supported limits. Corrupt non-JSON raw IDB values remain
unchanged instead of becoming an empty board; unavailable JSON export is explained. Foreign-format
recovery is not promised.

## Physical pen and quality check

The app cursor is a small outlined dot, eraser ring or pan hand. Release does not hide the dot;
missing digitizer coordinates retain the last valid position. Tools/modals/window inactivity hide
it. Canvas has a small Tab-focus badge («Полотно») instead of a blue frame; controls retain focus.

1. Open diagnostics; record Chrome/Wacom-driver versions.
2. Hover without touching: no ink. Write lines, dots, short strokes and fast loops; ink appears
   during movement and a short tap leaves a dot.
3. Check actual pointerType=pen and changing pressure under contact. Zero after release is normal.
   Constant-width Pen intentionally stays constant; choose Pressure pen for variable width.
4. Change width, start a new stroke: earlier ink keeps its width/shape.
5. Move outside/back during contact, then release: later hover/right-button motion must not draw.
6. Start ink and switch windows: return requires a new contact; unfinished ink may disappear,
   completed content remains. Resize/browser zoom preserves completed logical geometry and cancels
   unfinished ink; narrowing may hide content which returns when the surface grows.
7. Compare small text/loops/diagonals during drawing, after release and at board zoom 100/200/400%.
   No shape jump, extra segments or dark seams. Check positions through pan/zoom/return.

Report versions, pen-vs-mouse/pressure observations, perceived lag/gaps/letter distortion/unwanted
gestures and reproducible steps, including whether mouse input behaves similarly. Synthetic pen
checks event handling, not hardware pressure/comfort. If a driver reports mouse input, line checks
still work; investigate Windows Ink/driver setup against the observed failure.

Own board zoom, browser zoom and native page pinch are different paths. Inspect actual DPR/scale/
bitmap density; extreme resolution is memory-capped and does not guarantee arbitrary zoom quality.
Normal edge antialiasing is expected. Tune stabilization from 65% in small steps with the same phrase,
width and zoom; reduce if loops/turns round too much. Slider arrows adjust one step. The adaptive
filter uses the [1€ Filter](https://gery.casiez.net/1euro/) idea with local deviation limits/exact tips;
it is not a reproduction of Miro internals or a measured hardware-latency claim.

## Phones, tablets and Apple Pencil

By default pen writes, one finger pans and two fingers pan/zoom. Begin gestures on canvas; panels/
sliders retain normal scrolling. During pen contact fingers cannot move notes/view; lift previous
contacts before starting a new gesture.

Pen settings → Draw with finger («Рисовать пальцем») enables one-finger pen/eraser/selection;
a second finger cancels unfinished editing and starts navigation. The mode survives board switching
within the tab, resets off on reload. To place a template, prepare placement and tap the board;
a two-finger gesture cannot insert it.

Physical current-Safari/iPad checklist: write lines with light/heavy pressure; rest a palm while
writing; lift pen/fingers, pan/pinch and continue; rotate, open settings/library and rename with
the screen keyboard; select/move/undo and verify saved reload. No exact iPad/Pencil model is required
to launch. Chromium/WebKit touch automation does not prove actual latency, palm handling or a
specific Pencil. Double-tap/squeeze Pencil gestures are not implemented. Offline preparation is
covered separately above and is not proof of physical home-screen installation.

## Mathematical templates

Number line, XY and trig circle use versioned handwritten vector labels; old templates retain
legacy appearance. For line/XY choose From/To and Manual step. Ranges0…15,0…100,−100…100 at step 1
retain every tick/number by enlarging the figure; no hidden step substitution. Limit 201 ticks per axis,
32768 units per side; range includes zero. Invalid drafts keep the last valid preview and correction hint.

Fit («Целиком») shows the entire template by default. Detail («Крупно») shows a readable area
around zero; pan with mouse/finger or focused arrow keys without moving the board. Placement anchors
numeric zero at the click; large figures can extend offscreen, reachable with board navigation.
Circle Angles («Углы») controls outer radian labels; Coordinates («Координаты») controls inner ±1
independently, without an extra coordinate zero. Axis names remain. Preview/board/PNG share vector
glyph outlines without network fonts; JSON retains editable configuration and generator version.

## Development and publication

```bash
npm run lint
npm run format:check
npm run typecheck
npm run test:unit
npm run check:docs
npm run build
npm run preview
```

Preview serves a local build check at http://localhost:4173, not a production server. Repository
formatting uses `npm run format`. Install browser engines once with `npm run test:e2e:install`, then
run `npm run test:e2e`; it builds Pages output and owns port 4185 with isolated test data.

[STACK](STACK.md) owns setup/gates/required tools; [FRONTEND](FRONTEND.md) owns
`app → widgets → features → entities → shared`, public boundaries, native ownership and tests.
Geometry/history are browser/React-free; document/storage/jobs are separate from native rendering.
Recursive components/hooks/modules and scoped types/utils/config have real responsibility;
architecture policies reject private-boundary imports. [SPEC](SPEC.md) owns product intent;
[shipped history](changes/archive/README.md) preserves changes 01–34 with original evidence limits.
Workflow: `plan → work → manual product acceptance → ship`. The owner authorizes automatic local
ship after required gates/review; `ship --release` separately pushes main and verifies deployment.

[Pages workflow](../.github/workflows/pages.yml) checks PR/main lint/architecture/format/types/unit/
audit/build/browser regression. Successful main publishes only dist through GitHub Actions; PRs
have no deployment authority. Local Pages check:

```bash
npm run build:pages
npm run preview:pages
npm run audit:deps
npm run scan:secrets
```

Open http://localhost:4173/penable/. Pages uses `/penable/`, dev/ordinary build `/`. Renaming the
repository requires updating build/preview base and public links. CI uses Node.js 24 from
[.node-version](../.node-version) and npm ci. Gitleaks must be on PATH; scanning includes uncommitted
files, excludes generated dependencies/build/.git/local artifacts and redacts findings. Ignored
.artifacts/dependencies/build/.env are not published; release also scans Git history.

## Performance verification

```bash
npm run bench:build
npm run bench:serve
npm run bench:history
npm run bench:lifecycle
```

The standalone engine stand at http://127.0.0.1:4180 does not open saved notes or enter ordinary
app builds. Procedure/limits are in [STACK](STACK.md#change10--reproducible-engine-performance).

Historical Change10 measurements in three paired Windows Chrome 157 / DPR 1.215 runs: median p95 input+
paint batch time fell 2.2 → 0.5 ms for 10k points and 13.2 → 2.4 ms for 50k points. These are main-thread stand
times, not Wacom latency. A 1×1 native capture kept ~144 Hz RAF for both builds. 672 prefix raster
comparisons at zoom 25–800% / DPR 1–2 matched pixels. For 500 moves on a 20k-item scene, serialized history
graph size fell 74,557,939 → 66,439 bytes with full undo/redo. Node GC released 400 weak references to 200 finished/
cancelled strokes/point arrays; this is not browser GPU memory. Full redraw of 20k visible items
still costs substantial work, so document limits do not promise smoothness on every device.
