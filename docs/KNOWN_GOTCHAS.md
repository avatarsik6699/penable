# Known Gotchas

> Project memory file. Capture recurring pitfalls that repeatedly waste time during coding,
> testing, or deploys.

## How To Use

- Add only issues that are likely to happen again.
- Prefer concrete symptoms, root cause, and the shortest reliable fix.
- Remove entries that are no longer relevant.

## Gotcha Log

### Docker-owned files break host operations (`EACCES` / `EPERM` / read-only)

> Keep this entry only if the project uses Docker bind mounts. Otherwise delete it.

- **Symptoms**: file operations fail with `EACCES`, `EPERM`, "Permission denied", or "Read-only file system". Most common paths: container-generated build/cache directories on the host (`.nuxt/`, `.output/`, `node_modules/.cache/`, `__pycache__/`).
- **Root cause**: a Docker container wrote to a bind-mounted host directory as root.
- **Fix (host)**:
  ```bash
  sudo chown -R $USER:$USER <path>   # reclaim ownership, keep files
  sudo rm -rf <path>                 # OR discard the generated artefact
  ```
- **Agent protocol**: agents MUST NOT run `sudo`, `chmod -R 777`, or loop the failing operation. Instead, stop and post this exact handoff to the user (substituting real `<path>` and `<cmd>`):

  > ⛔ **Permission denied.** I cannot modify `<path>` while running `<cmd>`.
  >
  > This usually happens when a Docker container wrote files to a bind-mounted host directory as root. Please run one of the following on the host:
  >
  > ```bash
  > sudo chown -R $USER:$USER <path>
  > sudo rm -rf <path>
  > ```
  >
  > When the fix is applied, reply with the single word **`continue`** and I will retry the failed operation from the same step.

  On receiving `continue` (case-insensitive), retry the failed operation once. If it fails a second time with the same error, stop again and ask the user to confirm the fix was actually applied — do not loop a third time.

- **Prevention**: run Docker with a matching host UID/GID or use named volumes for cache directories that containers own.

<!--
### [Title — short, punchy, searchable]

- **Symptoms**: [what fails, what error message]
- **Root cause**: [why it happens]
- **Fix**: [shortest reliable fix]
- **Prevention**: [optional — how to avoid hitting it again]
- **Links**: [optional — docs / issue / PR]
-->


## WSL: Playwright preview hangs before launch

Symptom: URL-based webServer readiness hangs with no preview process, connection SYN-SENT to an
unbound loopback port. This host can drop rather than reject SYN; the availability probe runs
before Playwright's server launch timeout. Use documented webServer.wait.stdout for Vite's Local
line, strictPort:true and reuseExistingServer:false. Do not reuse the user's dev server or raise
all test timeouts. E2E owns4185 and isolated contexts; no browser profile cleanup is needed.

## Playwriter timeout does not cancel the snippet

Observed during Change15 native verification: executor uses Promise.race for its deadline, so an
async mouse loop or waiting locator can keep running after the CLI reports timeout. Starting
cleanup or another probe can race the old code and invalidate measurements.

Use short bounded input batches, explicit short locator timeouts, and locally captured page handles.
After a timed-out mutating snippet, close only the page the task created, verify it is closed, then
`playwriter session reset ID` before creating its replacement in the same session/group. Reset
replaces userState and reconnects handles; do not assign a replacement to the old shared state while
old code might still resume. Never close/reset user-owned pages or clear browser/application data.
Timed-out runs are not acceptance evidence. A replacement owned tab is a recovery exception to the
one-created-tab convention; avoid simultaneous task tabs.1px screencast cadence stabilization, if
used, must be disclosed and stopped after measurement (see STACK performance notes).

## Heavy E2E polling must project inside the browser

The durable selection translation assertion originally fetched all board/recovery records before
extracting two coordinates in Node. On the100k-point fixture, one observation transferred15MB and
took6.5–6.7s against a10s assertion deadline, so an old saved scene could consume nearly the whole
budget. Read the active catalog/board only and project clipped translations inside page.evaluate;
the same predicate then transferred31bytes in about70ms. Keep exact coordinate, worker-path and
undo/redo/reload assertions; do not solve observation overhead with retries or larger timeouts.

## Native pressure fill cost is not proven by unit or raster parity

A pressure stroke made from overlapping discs/quads in one nonzero fill passed geometry/raster
checks but the native10k-point fixture took p95265ms per input batch. A single ribbon improved
this, but rebuilding all border arrays/native commands every update still produced long tasks
on50k points. Incremental stable ribbon sections, closed256-segment strips and one native prefix
fill avoid cumulative reconstruction; keep round caps only at the actual endpoints. Never fix
this by dropping raw samples, using a bitmap stroke or raising test deadlines. Measure actual
native input/render batches and keep physical Wacom latency separate.

Direct-context and Path2D reference painters can differ in transform rounding. Compare like
representations, then inspect changed alpha coordinates and white composites; source/batch
agreement alone can conceal a shared algorithm defect. Preserve exact legacy and active/commit
checks. Tiny edge-only coverage differences against an experimental contour reference are
recorded separately from a visible seam or a change to accepted legacy handwriting.

## Design palette names are not production CSS variable names

DESIGN.md calls the blue color accent, but the actual token is --focus; selected/hover controls
use --control-selected-bg, --control-selected-text, --control-selected-border and --control-hover.
An undeclared --accent background silently becomes transparent and can make white button text
invisible; a browser click test alone will still pass. Check computed contrast/focus and inspect
the rendered primary action, including its hover state.


## WebKit ResizeObserver feedback from overlay fitting

Symptom: math panel switches pass visible assertions but emit “ResizeObserver loop completed
with undelivered notifications.” Updating only the preview observer does not fix it.

Root cause: shared Overlay.bindViewport observed panel/ancestors and wrote the CSS variables
that constrain their height inside the notification. Bottom-anchored math sheets additionally
used a height cap derived from their own top, creating staged growth across frames.

Keep initial fitting synchronous, coalesce later observer/window/visualViewport updates through
one owned RAF, dedupe writes and cancel before restoring inline properties on cleanup. A bottom
math sheet uses the explicit visualViewport/safe-area cap instead of self-derived available
height. Tag observer callbacks/targets/CSS writes to identify the owner; never filter the error.
Regression evidence: Change27 WebKit touch math, overlay/preview lifecycle tests and owned
observer trace. Preserve ancestor observation and keyboard fitting when changing this adapter.

## Async waitForFunction predicates can complete before the condition is true

Observed in Change31 service-worker activation tests with installed Playwright1.62.1. An async
predicate returns a truthy Promise before its resolved boolean is checked by the poller, so
`waitForFunction(async () => false)` can finish immediately. A reload then races activation,
leaving the new document uncontrolled when clients.claim is intentionally absent. Use
`expect.poll(() => page.evaluate(async () => condition)).toBe(true)` for resolved-value polling,
or observe the native lifecycle event before triggering it. Keep synchronous predicates for
DOM/native boolean checks. Do not add skipWaiting/claim, retries or arbitrary sleeps to mask it.

## Offline cache can mask deliberate worker-network failures in browser tests

After Change31, a successfully cached worker may load even when page.route intentionally aborts
its network URL. Failure-path tests then time out waiting for their expected error. The three
worker-fault fixtures explicitly remove only the optional serviceWorker capability before app
startup; their original network failure, recovery and saved-ink assertions stay intact. The
separate offline fixtures keep native SW support and verify real cache/update failure paths.
Do not disable SW globally, filter new runtime errors or weaken the fault assertions.


## Plain-stroke eraser benchmarks miss pressure and affine stalls

The original `penBench.eraser` measured ordinary hit-testing only, excluding preview and commit.
Pressure/affine candidates built a polygonal capsule before rejecting distant ink, per stroke and
coalesced sample. An800-stroke native test took76–126ms per batch while the ordinary case stayed
near1ms. Before optimizing eraser input, compare plain/pressure/transformed/clipped scenes with
actual preview redraw and history, and separate hit-test time from paint time. Gesture-local
conservative world bounds must reject distant items before masks/clipping/inverses; exact pressure
segments also need bounds before edge tests. Do not remove coalesced samples or relax hit accuracy.

## Bounded Worker messages do not bound main-thread IndexedDB reads

Native retrieval materializes stored values in the requesting realm. Change42's first packed
transport passed1M-point import/replacement/export with16–19ms UI gaps, yet opening still caused
668ms and584ms tasks while reading main and its backup. Move production read/decode into its
storage Worker and reuse the prepared load across Library/Session. Capture recovery Blob/error
snapshots there; a later key lookup would change readonly recovery semantics. Drain started
bootstrap transactions even after a logical storage invalidation, before terminating the Worker.

## A narrow Canvas clip can change full-path raster output

Change41's same-Path2D control reproduced alpha255 versus114 inside the dirty region, with
identical geometry/state and only the clip changed. A full-bounds sentinel removed that large
error but left changes outside geometric dirty bounds and100k framep95117.2ms. Bounds padding,
unit geometry checks and short JavaScript paint calls did not establish native raster parity or
speed. Keep the rejected prototype disabled and consult its feasibility record before retrying
retained partial replay. Exact output and settled native frames remain separate gates.

## Playwriter has a separate per-CDP-request deadline

A long `page.evaluate` can fail near30seconds with “Execution context was destroyed” even when
its CLI execution budget is45seconds. The installed relay independently times out forwarded CDP
requests after30000ms; the installed Playwright fork rewrites generic protocol errors into that
context error. Confirm `forwardCDPCommand` timeout in the relay log before inferring a tab crash.

For long owned benchmarks, start the promise inside the page without returning/awaiting it, store
its result/error and `performance.timeOrigin`, then use short read-only polls. Require unchanged
origin, successful completion and data integrity before acceptance. Never navigate or start another
mutating scenario while it is pending. Keep physical RAF cadence and CPU-only scheduling distinct.

## Windows native paste can carry a file while async clipboard items expose no formats

During Change43, an actual Windows Chrome Ctrl+V produced a native `Files` paste event, while
`navigator.clipboard.read()` resolved with one item whose `types` was empty. Successful async
read alone therefore does not prove that it exposes the native paste payload. Keep any supported
same-event PNG/JPEG File synchronously; event DataTransfer access cannot be deferred until after
an await. The narrow opaque-result fallback is governed by SPEC5.17 and is never tab cache.
Any exposed MIME, own-format advertisement, acquisition rejection/retry or cancellation suppresses
that fallback. Native read/getType transient errors use at most one fresh negotiation; permission
and decoding failures do not retry. Menu has no event File and must give Ctrl+V guidance after a
bounded opaque read. Do not synthesize an event or use deprecated execCommand to bypass access.

The [Clipboard API draft](https://w3c.github.io/clipboard-apis/#clipboarditem) describes lazy
getType fetching and changed clipboard state rejection. Keep failed-read, opaque-format and
corrupt-image regressions separate; they are distinct stages of insertion.
