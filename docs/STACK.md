# Stack Guide

> Source of truth for technologies, commands and required tools.
> Status: CONFIGURED; changes01–15 shipped locally; change07 published, changes08–15 await separate release.
> SPEC approved 2026-11-12. Target device: Wacom One, Windows 11.

## Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript, Vite SPA, colocated CSS Modules, Canvas 2D |
| Input | Pointer Events, world-coordinate controller outside React's rendering cycle |
| Icons | lucide-react1.72.0, static named imports |
| Selection geometry | polygon-clipping0.15.7; normalized local vector clips and source lineage |
| Background jobs | Native module Worker; bounded transferable point chunks for large selection/validation/save |
| Backend | n/a — browser only |
| Storage | Native IndexedDB, versioned one-board document; exclusive origin Web Lock; JSON backup |
| Package manager | npm, package-lock.json |
| Lint / format | Oxlint, TypeScript AST architecture policies/self-tests; Prettier3.9.6 / EditorConfig |
| Browser regression | Playwright1.62.1 Chromium, domain fixtures + Page Objects, isolated contexts |
| Unit tests | Vitest, node environment; src/**/*.test.ts |
| Infra | Loopback Vite in WSL, ordinary Windows Chrome; public HTTPS static hosting |
| CI / hosting | GitHub Actions; avatarsik6699/penable; https://avatarsik6699.github.io/penable/ |

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
| Lint | npm run lint | Oxlint, architecture/code-shape/platform/E2E policies and checker self-tests |
| Formatting | npm run format:check | Repository Prettier configuration; npm run format to apply |
| Type-check (affected) | npm run typecheck | Strict TypeScript, no emit; includes unit/E2E tests and Vite/Playwright configs |
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
| Pages build | npm run build:pages | Separate production build with /penable/ asset base; final dist is Pages artifact |
| Frontend unit tests | npm run test:unit | Includes input ownership/cancellation and coordinate transforms |
| E2E lint / determinism | npm run lint; npm run format:check | AST policies cover spec/fixture/Page Object ownership; spacing and self-tests included |
| E2E suite | npm run test:e2e:run | After build:pages; owns strict4185 preview and isolated Chromium contexts; run test:e2e:install once |
| Smoke | npm run dev; npm run preview:pages | Playwriter: active change scenarios; change07 verifies production /penable/ assets/input/storage at port4173; hardware acceptance is separate |
| SAST | npm run lint | Correctness-focused static analysis; not a dedicated security audit |
| Secrets scan | npm run scan:secrets | Gitleaks default rules; excludes only generated deps/build, Git internals and local artifacts; scans untracked files too |
| Dependency audit | npm run audit:deps | npm audit, moderate and above fail; includes development dependencies |
| Accessibility audit | n/a — formal automated audit deferred | Manual labels, focus, keyboard, contrast and responsive inspection required in Smoke |
| Performance regression | Owned-browser PerformanceObserver + active change fixtures | Change09 checks ordinary selection/move for attributable >=50ms Long Tasks and heavy-job responsiveness/cancellation; actual pen latency remains hardware acceptance |

## Release Gate

| Check | Command | Preconditions / notes |
|-------|---------|-----------------------|
| Container image scan | n/a | No container image |
| History secrets | gitleaks git . --log-opts=--all --redact --no-banner | Before public push; scan all local history |
| GitHub authentication | gh auth status | Before push; owner avatarsik6699 |
| Remote / repository | git remote get-url origin; gh api repos/avatarsik6699/penable --jq '{full_name,private,permissions}' | Before push; origin must target owner/penable, admin available |
| Publish | git push -u origin main | Only ship --release after Full Gate and pre-push Release Gate pass |
| Configure Pages | gh api --method POST repos/avatarsik6699/penable/pages -f build_type=workflow | One-time bootstrap after repository creation; if already enabled, GET validates workflow source; initial branch may need publishing first |
| Deploy verification | gh run list -R avatarsik6699/penable --json databaseId,headSha,status,conclusion,url; gh run watch RUN_ID -R avatarsik6699/penable --exit-status | After push; require successful build and deploy for exact pushed SHA |
| HTTPS health | curl --fail --silent --show-error https://avatarsik6699.github.io/penable/ | After deployment; verify HTML and referenced JS/CSS, then owned-browser live smoke |

Initial publication is explicitly owner-authorized. Create the empty public repository using
`gh repo create avatarsik6699/penable --public --source=. --remote=origin` only after checks.
Enable Pages with build_type=workflow and HTTPS enforcement. Only built dist is deployed.
The installed gh run list lacks --branch; match JSON headSha to the pushed commit.
Actions use pinned official commit SHAs; build has contents:read, deploy alone has pages/id-token write.
CI runs lint/format/typecheck/unit/audit/build:pages, installs Chromium and runs E2E on that same dist artifact before upload. Secrets scanning remains mandatory locally in Full
and Release Gates. No custom domain, cloud database, analytics or automatic note migration.

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
npm run test:unit -- src/entities/board/input/input.test.ts
npm run lint
npm run typecheck
```

Browser checks use Playwriter per AGENTS.md. Synthetic pointer events cover event handling;
real mouse actions cover the native event/capture path. Only the user confirms physical pen
pressure, driver behavior and the feeling of handwriting. Read README for the hardware checklist.

## Project structure

Binding composition and style rules: [FRONTEND.md](FRONTEND.md).

- src/app/: bootstrap/composition, reset/theme/tokens.
- src/widgets/board-workspace/: root composition/hooks/workspace model and recursive components; writing-surface owns editor native modules.
- src/features/board-document/: root DTO contracts, codec/session/jobs modules, platform adapters and recursive storage/import components/hooks.
- src/entities/board/: browser-free geometry/input/regions/viewport/selection/history modules, scoped types/config/utils and internal BoardSnapshot.
- src/shared/: narrowly owned platform services and reused controls.
- e2e/: fixture-owned contexts/data, Page Objects owning actions/assertions, domain-only specs.
- scripts/architecture/: TypeScript AST dependency/platform/code-shape/E2E policies and positive/negative self-tests.
- scripts/performance/: reproducible actual-engine and native raster measurements.
- docs/SPEC.md, FRONTEND.md, STACK.md: intent, architecture, tooling; changes/archive/: shipped history.
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
First local ship initialized main from feature/01-pen-input; change 01 is archived.
Change07 configures origin as https://github.com/avatarsik6699/penable.git and Actions-based Pages.


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


## Change08 — Exact Selection Contract

Approved SPEC5.9 is authoritative. Preserve raw geometry/profile, use clip+translation and
lineage; union same-source/same-offset masks for seam-free rendering. Document schema2 reads
schema1; IDB structure1 stays. First upgrade save preserves before-schema2 atomically without
changing before-import; provide both downloads. Existing document limits plus2048lasso vertices,
8192vertices/mask and100000mask vertices/document. Controls/PNG/edge-pan/fit-all per SPEC5.9.
All previews are transient; canonical mutations are prepared/validated atomic history replacements.
One source writer; final independent review and browser tests before local automatic ship.
Actual Wacom and OS clipboard acceptance are separate. No push/release authorized for08.

## Change09 — Area and Responsiveness Contract

SPEC5.10 retains the drawn region independently of ink bounds, including clipboard and PNG
whitespace. Shared cached immutable geometry must bypass active mutable ink. Selection preview
uses existing completed/live layers and RAF coalescing. Bounds use conservative adaptive/analytic
queries; preserve accepted source curves and partial-ink slivers.

Heavy selection/candidate validation and autosave run in a module Worker. Point transfer is
bounded and yields to the main thread; do not post one huge object or stringify it on main.
Strict external decode and worker-side candidate decode remain mandatory. Pending jobs use
cancellation/generation guards; failure cannot commit or discard notes. Autosave worker drains
transactions and closes its repository before the owning main-thread lease is released.
No persistent schema/dependency change; normal Vite builds must emit base-correct worker assets.
Explicit JSON import/export/load remain separately measured from selection/drag/save paths.

## Change10 — Reproducible engine performance

SPEC5.11 is authoritative. Live geometry consumes appended raw samples once, keeps the exact
provisional tip, and strokes one combined native prefix+tail path. Batch geometry is the reference;
new external documents still pass strict codec. Compact replacement history stores changed members,
retains full undo semantics and shared scene identity. No new drawing library/schema/index.

```
npm run bench:build
npm run bench:serve
npm run bench:history
npm run bench:lifecycle
```

Engine builds go to ignored `.artifacts/performance`, separate from Pages. Optional environment
variables `PENABLE_BENCH_SOURCE` (default src) and `PENABLE_BENCH_OUT` select an immutable source
snapshot and output. Serve baseline/candidate subfolders on127.0.0.1:4180 for comparison.
Load playwriter skill, create one owned tab/session, navigate to the benchmark, then execute
`scripts/performance/browser.js` using `playwriter -s ID -f ...`. Set `state.label` to baseline or
candidate for artifacts. Runner saves evidence then fails on raster/scene/ordinary-long-task/console
regressions. `compare.js` is a measurement collector: run with `state.pair=1/2/3` for alternating
baseline/candidate pairs; it rejects idle RAF throttling, not timing variance. Warmup is excluded.

Chrome may deliver1Hz RAF even when document.visibilityState is visible. Check an idle probe
before timing. During this check, Page.startScreencast at1×1px with screencastFrame acknowledgements
restored~7ms cadence in the owned Playwriter tab; stop the capture afterwards. Apply identical
capture conditions to both builds and disclose capture overhead. Never infer FPS from task mode:
`penBench.schedule('tasks')` is available only for main-thread work comparisons.

Recorded metrics describe synchronous input+renderer batches paced by RAF and manual engine flush,
not physical pen-to-photon latency or the app's whole compositor pipeline. Eraser fixture measures
hit-testing only; actual erase-preview/commit needs app smoke. Browser GC is unavailable through
this extension (heap snapshots are allocation observations, not retained-memory proof). The Node
lifecycle check explicitly collects JS geometry-cache owners; it does not measure browser/GPU
memory. History benchmark measures serialized reachable graph growth, not total heap bytes.
Preserve existing bitmap budget. Hardware Wacom and multi-hour real use remain separate acceptance.

## Change11 — Architecture and executable contracts

SPEC5.12 and FRONTEND are authoritative. Dependencies descend app→widgets→features→entities→shared
through explicit public roots. No React/native canvas/codec/worker protocol in entities/board.
Exact-file platform capability registry lives in scripts/architecture/policy.mjs; extending it
requires inspecting concrete ownership. No folder-wide platform exemptions. AST checks include
worker transitive graphs, import aliases/dynamic/type edges, cycles and component conventions.

Internal BoardSnapshot has no format/schemaVersion; feature codec owns persisted schema1/2 and
64MiB byte policy. Tab owns clipboard/document session/durable worker; editor generation owns
renderer/selection worker/bindings. Import recreates editor without closing its durable writer.
UI uses a cached coarse useSyncExternalStore projection; scene capture is an explicit separate API.

```
npm run format
npm run format:check
npm run lint:architecture
npm run test:architecture
npm run test:e2e:install
npm run test:e2e
```

`test:e2e` builds Pages then runs the suite. `test:e2e:run` reuses only the already-built dist files,
never an existing server. PENABLE_E2E_DIST can select an owned immutable Pages build for baseline
comparison. Preview owns127.0.0.1:4185, strictPort and reuseExistingServer:false. Readiness uses
Playwright webServer.wait.stdout (Vite Local line): this WSL host drops SYN to unbound ports, so
URL preflight hangs before server startup. See KNOWN_GOTCHAS. Specs cannot directly access driver,
assertions, constructors or test-data literals. Real IDB/lease/worker paths run in isolated contexts;
normal smoke and intentional worker failure are separate. Interactive Playwriter remains required.

Performance baseline for11 is5624f9e (change10 shipped), not change10's earlier baseline. Build
legacy source via PENABLE_BENCH_SOURCE or current layered APIs through supported owner entrypoints;
no engine copy. Preserve672 native raster comparisons. Run three alternating before/after pairs;
per fixture median p95 must be <=max(1ms,baseline*1.2), with no attributable >=50ms ordinary tasks.
These measurements describe CPU/RAF batches, not physical pen latency or GPU retained memory.


## Change12 — Code spacing

FRONTEND defines readable blank-line boundaries. Existing npm run format commands first normalize
with Prettier, apply scripts/formatting/spacing.mjs, then rerun Prettier; only whitespace is inserted.
The syntax-aware pass separates module sections, class actions/methods and logical statement groups,
leaving compact data/declaration/assignment groups and overloads intact. It preserves comment
ownership and literal contents. CSS rule spacing is preserved by Prettier and source convention.

`npm run lint:spacing` checks JS/TS structural spacing; `npm run test:spacing` tests preservation,
comments, overloads and idempotence. Both are included in npm run lint; npm run format:check also
checks spacing. No extra dependency or application runtime change.


## Change13 — Fractal modules

SPEC5.13 and FRONTEND Recursive modules govern source decomposition. FSD outer slices retain their
public roots and downward dependencies; local modules/components recurse through explicit index.ts
boundaries. Root/component implementations own colocated .types/CSS; actual React hooks live in
hooks/use-*.ts, native per-sample work remains outside hooks. Pure helpers/static policy use scoped
.utils/.config files. There are no empty mandatory folders or generic types/utils/config dumps.

Architecture checks reject private child imports/type reexports, own/ancestor barrels, misplaced
hooks, root components with mismatched locations and native APIs in components/hooks. Exact-file
capabilities own concrete native adapters; worker graphs remain UI/React/native-free. File size is
review evidence rather than an arbitrary hard limit; ownership and independent acceptance decide
whether a coordinator/algorithm is cohesive.

`npm run format:e2e` formats only parent-owned browser tests during concurrent source/policy work.
Source writer uses format:source; policy writer uses format:architecture. Final format:check covers
all code. Preserve416 pre-existing behavioral cases,672 raster cases and the original9 browser
scenarios; add cursor/native pan/modal/slider regression to exercise decomposed UI/bindings.


## Change14 — Isolated design mock

`npm run mock:serve` serves only docs/design/editor-v1 on loopback4190, using Python3 standard HTTP
server. It fails on occupied port; do not stop another process or change origins silently.
`npm run format:mock` owns mock HTML/CSS/JS/JSON formatting; Markdown follows existing exclusions,
and authored SVG is validated as XML. `npm run lint:mock` is included in lint,
and format:check also checks the mock. No new package dependencies or production source changes.

Browser smoke for14 uses five mock states at1440×900 and1280×720; screenshots in the mock's previews/
folder are proposal artifacts. State/slider/menu interactions are demonstrative, with no storage,
clipboard, file access or external network actions; only same-origin mock assets are fetched. PRODUCT.md is high-level design context linked to SPEC;
mock BRIEF/DESIGN documents are explicitly proposals, not current implementation authority.
The Full Gate still runs production checks; unchanged source and Pages build bytes establish that
engine performance/raster acceptance remains unchanged. No physical pen acceptance claimed for mock.


## Change15 — Production floating UI

Owner-approved Change14 mock is the visual reference; SPEC5.3/5.14 governs the production transfer.
Root DESIGN.md and .impeccable/design.json describe the built visual system; SPEC remains behavior authority.
No new runtime package or data schema. Existing source commands/gates remain mandatory.
Parent may run `npm run preview:pages -- --port 4191 --strictPort` for isolated native production
smoke (4192 if4191 already contains notes); never open or mutate the owner's localhost:5173 data. Native benchmark uses existing bench
commands on4180. Full Gate still owns4185. Desktop1440×900/1280×720 and compact390×844 checks
include real command disclosure, one panel at a time, keyboard/focus, import/recovery/busy/read-only,
stable canvas dimensions/generation and no ink from UI. Hardware latency and OS clipboard separate.

## Change16 — Board settings and overview

SPEC5.15 governs schema3 metadata, unified settings, return-to-writing/100% and minimap. Use the
existing Fast/Full commands, Playwriter first; owner-authorized lucide-react1.72.0 supplies static named SVG icons. Parent may run an isolated
Pages preview on4196 for native Change16 tests (strict port), never mutate localhost owner data.
Performance baseline source is captured in.artifacts/change-16/baseline-src, build via existing
PENABLE_BENCH_SOURCE/PENABLE_BENCH_OUT with bench:build;4180 serves change16-baseline/candidate
folders. Minimap uses a separate lazy worker; existing two ink layers keep their budget and overview
backing caps512×320. No whole-folder platform exemption; each new native/worker owner is explicit.
Read legacy1/2; firstwrite3 preserves raw before-schema3 in the same transaction. Native same-origin
fault injection is on owned test page only. Hardware pen/OS clipboard claims remain separate.
