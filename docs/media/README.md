# README demonstration media

These files show the production Pages build of penable in ordinary Windows Chrome, driven through
Playwriter. The English notes are authored demonstration data. Every stroke, selection, zoom,
board switch and template insertion uses the app's real UI; no mock interface is composited into
these images. Scripted mouse input and paced playback do **not** measure physical pen latency or
prove Wacom/Pencil acceptance.

| Clip | What happens | Static alternative |
|---|---|---|
| [Writing](writing.gif) | Write a² + b² = c², zoom to 200%, return to 100% | [PNG](writing.png) |
| [Fragment editing](fragment-editing.gif) | Lasso b² plus the crossing underline segment, move only that region, undo | [PNG](fragment-editing.png) |
| [Math and boards](math-boards.gif) | Switch boards, configure and place a trigonometric circle | [PNG](math-boards.png) |

Each GIF is 960×600, 10 seconds and 100 frames at 10 fps, below 3 MiB. The three GIFs together are
about 516 KiB. [manifest.json](manifest.json) records the app commit, exact sizes and SHA-256 hashes.
Static PNGs are the motion-free alternative. Opening, intermediate and final frames were inspected;
final selection undo restores the equation and its continuous underline.

## Reproduce the capture

Requires the repository's Node/npm setup, Python 3, FFmpeg/ffprobe and the configured Playwriter
CLI/Chrome extension. Context7 was unavailable; APIs were checked against official
[Playwright](https://playwright.dev/docs/api/class-page), [FFmpeg](https://ffmpeg.org/ffmpeg-filters.html#palettegen)
and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/databases) documentation.

From the repository root:

```bash
npm ci
git diff --exit-code HEAD -- src index.html public vite.config.ts package-lock.json
git diff HEAD -- package.json
git rev-parse HEAD
npm run build:pages
npm run preview:pages -- --port 4217 --strictPort
playwriter skill
playwriter session list
playwriter session new --tab-group penable
```

Before building, verify application sources match HEAD (the first check must pass). Review the
package diff too: only the docs-only `media:encode` script may differ. Record the printed full commit and pass it
to `DemoCapture.create` below. If application/build inputs are dirty, commit them before recording
instead of attributing that build to HEAD. Do not change those inputs between build and capture.

Use one task session and one owned tab. Substitute the returned session ID below. `prepare`
first opens the manifest without booting the app and checks that this origin has **no existing
IndexedDB databases**. It aborts if data exists: choose another unused preview port instead of
clearing storage. It then selects English before the first app load and sets 1280×800.

```js
// Run with playwriter -s ID -e '...' or an owned -f script.
state.page = await context.newPage();
state.cdp = await getCDPSession({ page: state.page });
const { DemoCapture } = await import("./scripts/media/capture.mjs");
const { Handwriting } = await import("./scripts/media/handwriting.mjs");
state.capture = DemoCapture.create(state.page, state.cdp, "FULL_VERIFIED_BUILD_COMMIT");
state.handwriting = Handwriting;
await state.capture.prepare("http://127.0.0.1:4217/penable/");
await ghostCursor.hide({ page: state.page });
console.log(await snapshot({ page: state.page }));
console.log(await getLatestLogs({ page: state.page, sinceLastCall: true }));
```

Observe a scoped snapshot and fresh logs after each UI action. Click text inputs before filling
in extension mode. Pen settings open by clicking the selected **Pen**; the palette buttons are
**Color: Blue** and **Color: Dark**. **Close pen settings** dismisses the panel.

Prepare two new demonstration boards through the UI:

1. Rename the fresh **My board** to **Study notes**: Boards → Board actions → Rename board →
   Board name → Save name. Create **Math guides** through New board → New board name → Create board.
2. On Math guides choose blue Pen and draw `Handwriting.word("TRIGONOMETRY", 190, 143, 28)`.
3. Switch to Study notes; Board settings → View → Dots. Choose blue Pen and draw
   `Handwriting.heading`; choose dark Pen and draw `Handwriting.subtitle`, `Handwriting.triangle`
   and `Handwriting.word("THEOREM", 650, 241, 18)`. `capture.draw(paths)` uses held mouse strokes.

Capture in these bounded steps; do not rerun a stage over its already-created content:

| Stage | Actions / source calls |
|---|---|
| Writing | `capture.start("writing", 10)`; `frame(8)`; `draw(Handwriting.equation, true)`; `frame(10)`; click Zoom in board, observe 200%, `frame(16)`; click percentage reset, observe 100%, wait for saved status, `frame(22)`; `finish()` |
| Fragment | `start("fragment-editing", 10)`; `frame(8)`; click Selection, `frame(3)`; click Lasso, `frame(3)`; `draw([Handwriting.lasso], true)`; `frame(8)`; `drag([770,385], [850,515], 12)`; `frame(12)`; save `poster = await frame(6)`; click Undo, observe restored equation, `frame(20)`; `finish(poster)` |
| Math | `start("math-boards", 10)`; `frame(8)`; open Boards, `frame(8)`; open Math guides, `frame(8)`; open Shapes and templates, `frame(6)`; choose Trigonometric circle, `frame(12)`; choose Color: Blue, `frame(6)`; Place on board; move to [700,420], [610,440], [640,450], capturing weights 4/4/8; click [640,450], `frame(12)`; select Pen, move pointer away, `frame(14)`; `finish()` |

Pass each path array to `await state.capture.draw(...)`. `frame(weight)` stores a real screenshot;
weights set readable holds when encoding. Every finished take is retained under the ignored
`.artifacts/change-37/frames/NAME/take-N/`, so a new take never deletes earlier evidence. Actual
screenshot bytes can differ with browser versions and paint scheduling; the workflow and data
remain reproducible.

The capture helper uses page-scoped CDP screenshots. The installed extension's frame-evaluation
path was unreliable, so it does not use `page.evaluate` or depend on that screenshot path. For a
Playwriter timeout, follow [Known Gotchas](../KNOWN_GOTCHAS.md#playwriter-timeout-does-not-cancel-the-snippet):
close only the owned tab and reset its task session before replacement. When done, close only the
created tab and delete the task session; keep the person's other tabs and profiles intact.

## Encode and inspect

```bash
npm run media:encode
ffprobe -v error -show_entries stream=width,height,nb_frames:format=duration,size -of json docs/media/writing.gif
```

The [encoder](../../scripts/media/encode.py) takes the latest finished take for each clip, normalizes
its weighted sequence to ten seconds, generates a palette, exports GIF/PNG, enforces dimensions/
size/duration budgets and writes the manifest. Every take records its verified capture commit;
encoding rejects missing or mixed versions and preserves that commit even after HEAD changes. Review playback and opening/action/final frames
before updating the README. Raw captures remain ignored; only final media and sources are tracked.

The [centerline samples](../../scripts/media/handwriting.mjs) are original authored paths, not a
font or recorded handwriting. Mathematical labels use penable's existing KleeOne atlas; its
[provenance and license](../../src/entities/board/templates/modules/glyphs/PROVENANCE.md) remain intact.
