# Stack Guide

> Source of truth for technologies, commands and required tools.
> Status: CONFIGURED; M1 and change 02 quality/navigation are archived and accepted.
> SPEC approved 2026-11-12. Target device: Wacom One, Windows 11.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript, Vite SPA, plain CSS, Canvas 2D |
| Input | Pointer Events, world-coordinate controller outside React's rendering cycle |
| Backend | n/a — browser only |
| Storage | M1: tab memory only. IndexedDB deferred to M3 |
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
| Migrations | n/a | No persistent storage in M1 |
| Backend test suite | n/a | No backend |
| Frontend build | npm run build | TypeScript followed by Vite static build |
| Frontend unit tests | npm run test:unit | Includes input ownership/cancellation and coordinate transforms |
| E2E lint / determinism | n/a | No automated E2E runner |
| E2E suite | n/a | Interactive browser evidence required in Smoke |
| Smoke | npm run dev | Playwriter: task T2 scenarios; hardware acceptance T3 is separate |
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
| Hardware acceptance | User with Wacom One / Windows 11 | T3 after browser checks | Cannot be substituted by synthetic pen events |

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
- src/drawing/: stroke model/input, pure world/viewport transforms, shared curve geometry, layered Canvas renderer.
- src/App.tsx: owns slow interface state, not high-frequency stroke geometry.
- vite.config.ts, tsconfig.json, .oxlintrc.json: project configuration.
- docs/SPEC.md: approved intent and quality contract; docs/changes/: active work; archived changes 01/02: accepted input and ink quality.
- docs/playbooks/, .agents/skills/, .claude/skills/, plugins/sdd-workflow/: installed workflow.

## Implementation conventions

Keep per-sample input out of React state. The controller owns the active pointer and scene;
renderers consume geometry. Use effect cleanup for subscriptions, ResizeObserver, DPR listeners,
diagnostics timers and any animation frames. Preserve completed strokes on resize and cancel.
DPR affects the backing bitmap, not stored geometry. No store, router or drawing SDK required.
Change 02 adds board navigation and quality. Persistence, eraser, undo/redo and grids remain deferred.

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
