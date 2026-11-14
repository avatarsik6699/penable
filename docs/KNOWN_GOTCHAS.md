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
