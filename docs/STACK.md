# Stack Guide

> Source of truth for technologies, commands and required tools.
> Status: CONFIGURED; changes 01–05 shipped locally; change06 stabilizes cursor/navigation/UI.
> SPEC approved 2026-11-12. Target device: Wacom One, Windows 11.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript, Vite SPA, plain CSS, Canvas 2D |
| Input | Pointer Events, world-coordinate controller outside React's rendering cycle |
| Backend | n/a — browser only |
| Storage | Native IndexedDB, versioned one-board document; exclusive origin Web Lock; JSON backup |
| Package manager | npm, package-lock.json |
| Lint | Oxlint; native TypeScript/React rules including hooks; .oxlintrc.json |
| Unit tests | Vitest, node environment; src/**/*.test.ts |
| Infra | Loopback Vite in WSL, ordinary Windows Chrome |
| CI / hosting | Not configured; release blocked |

## Prerequisites

Node supported by package.json engines: 22.12+ within Node 22, Node 24, or Node 26+.
Observed environment: Node 24.21.0, npm 11.19.0. Lockfile is the authority for package versions.
Gitleaks must be installed on PATH for the mandatory secrets scan; it is available on this machine.
No Docker, backend, database, environment variables or credentials are required.

## Initial setup

```bash
npm ci
npm run dev
```

Open http://localhost:5173 in Windows Chrome. server.host is 127.0.0.1 and strictPort is true:
port conflicts must be resolved explicitly, not silently moved to another origin.
Use the Windows browser for tablet acceptance, not a WSL/headless browser.

## Fast Gate

Run applicable rows after each task, scoped to changed behavior. API generation is inapplicable.

| Check | Command | Preconditions / notes |
|-------|---------|-----------------------|
| Lint | npm run lint | Oxlint checks src and vite.config.ts, including React hook rules |
| Type-check (affected) | npm run typecheck | Strict TypeScript, no emit; includes tests and Vite config |
| Targeted / affected unit tests | npm run test:unit | Optional file argument scopes cases; no passing empty test suites |
| LSP diagnostics | TypeScript LSP diagnostics | Tool exposed; run on changed TS files; disclose tool failure separately from tsc |
| API type regen | n/a | No API |

## Full Gate

Reserved for /ship; /work does not certify the Full Gate or merge/archive work.
A focused build is appropriate when establishing/changing build configuration.

| Check | Command | Preconditions / notes |
|-------|---------|-----------------------|
| Infrastructure / bootstrap | npm ci | Requires lockfile |
| Migrations | n/a — no CLI migration | Native IDB upgrade from0→1 on first open; browser smoke covers schema/load |
| Backend test suite | n/a | No backend |
| Frontend build | npm run build | TypeScript followed by Vite static build |
| Frontend unit tests | npm run test:unit | Includes input ownership/cancellation and coordinate transforms |
| E2E lint / determinism | n/a | No automated E2E runner |
| E2E suite | n/a | Interactive browser evidence required in Smoke |
| Smoke | npm run dev | Playwriter: active change T2 scenarios; user acceptance T3 is separate |
| SAST | npm run lint | Correctness-focused static analysis; not a dedicated security audit |
| Secrets scan | npm run scan:secrets | Gitleaks default rules; excludes only generated deps/build, Git internals and local artifacts; scans untracked files too |
| Dependency audit | npm run audit:deps | npm audit, moderate and above fail; includes development dependencies |
| Accessibility audit | n/a — formal automated audit deferred | Manual labels, focus, keyboard, contrast and responsive inspection required in Smoke |
| Performance budget | n/a — numeric latency target not agreed | User evaluates actual pen response; event frequency is not end-to-end latency |

## Release Gate

| Check | Command | Preconditions / notes |
|-------|---------|-----------------------|
| Container image scan | n/a | No container image |
| Deploy / health check | Not configured | No hosting or deploy target; release blocked |
| gh authenticated for this repo | Not verified | No remote; release blocked |

## Required Tooling

| Domain | Required tool/skill | When | Available in this project |
|--------|---------------------|------|---------------------------|
| Interactive frontend verification | playwriter skill + CLI; Chrome DevTools MCP fallback | Before checking off UI tasks | CLI connected to Windows Chrome; use one penable task session |
| TypeScript change | TypeScript LSP diagnostics + tsc | After implementation | Tools exposed; project state must be checked |
| Architecture | frontend-architecture | Before structural decisions | Consulted during plan |
| Frontend design | frontend-design; impeccable for bounded craft review | Preserve SPEC §5.3 | Skills available; no new visual direction required |
| New API | n/a | No backend | n/a |
| User acceptance | User in Windows Chrome; Wacom when relevant | Active change T3 | Physical writing accepted; storage/backup require their own user check |

## Testing

```bash
npm run test:unit
npm run test:unit -- src/drawing/input.test.ts
npm run lint
npm run typecheck
```

Browser checks use Playwriter per AGENTS.md. Synthetic pointer events cover event handling;
real mouse actions cover the native event/capture path. Only the user confirms physical pen
pressure, driver behavior and the feeling of handwriting. Read README for the hardware checklist.

## Project structure

- src/components/: toolbar, diagnostics and writing surface.
- src/drawing/: stroke model/input/history, world/viewport/background transforms, shared curve geometry, layered Canvas renderer.
- src/document/: versioned codec, native IDB, writer lease and serialized save session.
- src/App.tsx: owns slow interface/document lifecycle state, not high-frequency stroke geometry.
- vite.config.ts, tsconfig.json, .oxlintrc.json: project configuration.
- docs/SPEC.md: approved intent and quality contract; docs/changes/: active work; archived changes 01–05: accepted input, ink quality, history/backgrounds, local storage/backup and whole-stroke eraser.
- docs/playbooks/, .agents/skills/, .claude/skills/, plugins/sdd-workflow/: installed workflow.

## Implementation conventions

Keep per-sample input out of React state. The controller owns the active pointer and scene;
renderers consume geometry. Use effect cleanup for subscriptions, ResizeObserver, DPR listeners,
diagnostics timers and any animation frames. Preserve completed strokes on resize and cancel.
DPR affects the backing bitmap, not stored geometry. No store, router or drawing SDK required.
Changes02/03 provide accepted navigation/quality/history/background. Change04 adds persistence;
change05 adds whole-stroke erasure with grouped action history and renderer-only previews.

Only repository-defined lint commands may run; no imported formatter. Tests must check
observable behavior and invariants, without exposing application internals solely for a test.
Use Context7 before external library APIs. Keep security scanning output redacted.

## Bootstrap and environment

Workflow source: https://github.com/avatarsik6699/sdd-workflow
Installed revision: 22ad1fdad73744f10ebc9e0b9df9057c699d4734 on 2026-11-12.
Root and plugin MCP declarations were copied from the bundle; Context7/OpenAI docs tools are
already exposed in the session. Generic/Claude wrappers are installed locally; copying the
Codex plugin or hooks.json does not prove native activation. Procedures can run from playbooks.
First local ship initialized main from feature/01-pen-input; change 01 is archived. No remote configured.


## Change 02 — Quality and Viewport Contract

- Shared pure geometry builds a full curve from raw world points. Consecutive duplicate XY
  are ignored by derived geometry; raw pressure/time samples remain available. Same path
  for active, commit and full redraw; one-point contact is a dot.
- Optional pure stabilization precedes curve generation. Snapshot strength 0–100 plus capture
  zoom per stroke; old off/light/strong profiles retain their geometry at 0/50/100 respectively.
  Unprofiled strokes remain off. Width 0.5–12 with UI step 0.1, strength step 1.
  Use a shared 2D speed cutoff, bounded deviation
  in capture-time CSS units, exact first/last positions, duplicate XY skipped before filtering.
  No new dependency, prediction or timer; physical lettering/lag remains user acceptance.
- Two transparent canvas layers: completed below, active above. Accumulate samples outside
  React and coalesce drawing through RAF. Completed layer is unchanged on ordinary pointer
  move; commit queue handles multiple finished strokes before a frame.
- Viewport: screen = world × zoom + offset, zoom 0.25–8. Cursor-anchored wheel/ctrl-wheel;
  Space+primary or middle-button pan; +/− centered; percentage button resets zoom and offset.
  Own navigation is ignored during active ink; genuine resize/DPR changes cancel active ink.
- Backing density: requested DPR × visualViewport.scale, actual bitmap-to-CSS ratios after
  integer rounding. Native pinch scale changes require rerender from geometry. Listen to
  visualViewport resize and retain DPR/resize/physical-observer fallbacks.
- Two-layer budget: total 16,777,216 pixels (about 64 MiB raw RGBA, browser overhead extra),
  maximum side 8192. If capped, diagnostics distinguish requested and effective resolution;
  do not claim unlimited native pinch quality. Own board zoom changes geometry transform,
  not canvas allocation.
- Unit gate covers coordinates/anchor/clamps, geometry invariants, raster limits and render
  scheduling/commit lifecycle. Browser evidence uses own 100/200/400% zoom, DPR 1/2, native
  visualViewport pinch/page zoom, tap/loops/diagonals and active-to-completed comparisons.
- Baseline at main 8d97a58: 29 tests/lint/types passed. Native pinch probe changed scale 1→2
  with unchanged DPR and unchanged bitmap 1921×703. Old build saved in ignored
  .artifacts/change-02/baseline-dist for comparison at local port 4174 only during verification.
- The previous silent-DPR-only CDP limitation remains separate from native pinch evidence;
  inspect actual visualViewport.scale and bitmap dimensions before asserting a test passed.
- Browser automation may refresh current test notes: user explicitly allowed it in this session.

## Change 03 — History and Background Contract

- History owns completed-stroke commit/undo/redo mutations. Redo clears only on a new commit;
  cancel, viewport/background/tool changes preserve it. Store the same stroke objects/profiles.
- Input reports a finalized stroke to the surface; history commits it before renderer.commit.
  Undo/redo invalidate the complete scene and pending commit queue, including before RAF.
- UI history state updates only on boolean changes. Actual input/pan ownership guards history,
  independently of throttled diagnostics. Keyboard uses physical KeyZ with Ctrl/Meta and Shift;
  preserve text/select/editable native undo, ignore Alt/composition/default-prevented events.
- Background is a CSS pattern behind the existing two canvases, default blank. Base24 world
  units, doubled until screen spacing>=12px, positive-modulo phase under negative pan.
  Update CSS variables from viewport callbacks; no third bitmap, history entries or React pan updates.
- Acceptance includes queue/undo/redo ordering, identity, cancellation, keyboard/busy guards,
  world anchoring, unchanged ink/allocation, desktop/narrow layout and clean fresh console.

## Change 04 — Local Document Contract

- NativeIDB database `penable` v1, out-of-line store `documents`, keys `main`/`before-import`.
  Load distinguishes missing key from present null/undefined/corrupt data. No silent reset/delete.
  Writes/replacement resolve on transaction.complete; errors/abort/blocked/versionchange are explicit.
- Document `penable-board`, schemaVersion1: committed rawstrokes/profiles, viewport/background/tools.
  Strict codec/known-field reconstruction, dense arrays/finite/range/unique IDs and64MiB/20k strokes/
  1M totalpoints/100k perstroke limits. No pointerIds/active/pixels/session history in backups.
- Hold exclusive `penable:board:main` WebLock while writing. Secondary is readonly; retry acquires
  then reloads. No localStorage pseudo-lease or stealing. NoLocks means explicit readonly error.
- Session boot gate, serialized revision-aware writes, immutable capture atflush,300ms debounce/
  1500ms maxwait for view/tools, errorpause+retry/export; dedupe status updates, no perpoint persistence.
  Dispose drains old transactions/closes DB before lease release. StrictMode setup waits prior dispose.
- App/Surface hydrate by documentgeneration, synchronous guards and currentsettingsrefs; baseline
  undoFloor protects hydrated strokes. ID allocation must remain valid after supported boundary IDs.
- Import validates then previews/confirms, freezes mutations/drains writes, atomically backs up current
  completed memory plus replaces main, and only then applies live scene. JSON-compatible previouscopy
  remains downloadable afterreload; arbitrary nonJSON corruption stays raw without false file promises.
- Automated browserstorage tests use OWN `http://127.0.0.1:5173`, isolated from user's localhost origin.
  RealIDB reload/abort/error/import/two-tab lease checks complement injected-adapter unit races.
  Do not clear profiles or user's localhost DB. Captured download payload is not filesystem-save proof.

## Change05 — Eraser Contract

- Separate pen/eraser controllers, common pointer ownership guards in Surface. Selected tool is
  ephemeral; initial load/import selects Pen. Read-only/import/busy synchronously guard changes.
- Eraser preview owns a Set of stroke objects; canonical strokes/snapshot remain unchanged until
  pointerup. Cancel/blur/resize/lost capture/permission loss restore preview without save/history.
- Hit-test reuses accepted stabilized positions/geometry with swept segments,8CSSpx radius/zoom
  plus half stroke width. Bound curve approximation error, cover collinear backtracking quadratics.
- History is add/erase actions with original object/index; loaded writing is baseline, later erase
  undo restores loaded strokes. Empty/cancelled erasure and tool changes preserve redo.
- Renderer preview/cancel/removal/history invalidate completed scene and queued commits. Keep the
  existing incremental pen path, geometry and two-layer bitmap budget. No document/schema changes.

## Change06 — Board UX Contract

- Cursor is ephemeral DOM presentation, local CSS position and one RAF, never part of ink/snapshot.
  Dot3px+white1px halo, eraser ring8radius, pan hand; retain pen proximity-leave position, guard
  active owner and UI/modal/blur. Canvas Tab-focus uses a small badge, global control focus remains.
- Plain wheel pans2axes; Ctrl/pinch zoom anchors25–800%; Shift maps vertical-only scroll horizontally.
  Normalize pixel/line16/page-axis units; suppress wheel during pointer input and quarantine any
  overlapping stream until150ms quiet. No device guessing or per-sample React/timer.
- Storage uses stable status/export/import/Хранение row with secondary actions/details in a
  nonmodal out-of-flow panel. Status/error/notice changes cannot resize canvas or steal focus.
- Busy UI follows immediate history state, guards remain synchronous. Read-only navigation does
  not persist. Keep schema1 and accepted stroke geometry. Physical Wacom/trackpad checks are
  reported separately; successful automated gates/review trigger owner-authorized local ship.
