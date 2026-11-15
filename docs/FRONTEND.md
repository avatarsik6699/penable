# Frontend contract

Binding for Penable production source and its test/tooling boundaries. Product behavior lives in
SPEC; commands and gates live in STACK. Approved change11 adapts infraegev2 FRONTEND §§2–4,6,
its reading-position adapter/model split, explicit session ownership and executable policies.
The reference checkout is read-only. Existing visual direction and legacy schema1/2 compatibility are retained; schema3 metadata is governed by SPEC5.15; schema4 ordered items/assets and named boards by SPEC5.16.

## Layers and public APIs

`app → widgets → features → entities → shared`; imports may skip downward layers.

- app is composition/bootstrap/theme, not document or editor use cases.
- widgets/board-workspace owns tool/surface composition, native Canvas painting/path caches,
  cursor/background/outline presenters and pointer/keyboard/resize bindings.
- features/board-document owns schema DTO/codec, image asset validation, board catalog/library, repository/lease, worker protocol/client/entry,
  document session, import/export model and storage presentation.
- entities/board owns strokes/scene/viewport, semantic input/selection/navigation/history,
  IDs/scene limits and browser-free geometry/stabilization/regions.
- shared contains focused domain-agnostic platform adapters and actually reused controls.
- No same-layer peer imports in widgets/features/entities; compose peers above. shared primitives
  may compose through their public roots. Cross-owner imports use explicit index.ts exports;
  no private deep imports, wildcard barrels, upward imports, cycles or own-barrel imports.
- Internal imports stay relative. Cross-owner alias is `~/`. Worker entry is an explicit separate
  execution boundary with local feature imports; React/UI/native canvas cannot enter its graph.
- Do not create empty routes/pages, generic DI containers, repositories, stores or drawing SDKs.

## Recursive modules and decomposition

The owner explicitly chooses a pragmatic FSD outer graph with fractal internals. A slice/module
owns a root implementation, explicit index.ts API and local root-qualified *.types.ts. It may
contain components/, hooks/, modules/ (cohesive non-UI capabilities) and platform adapters/native
code according to responsibility. Child components/modules may repeat this same structure.
Remove the generic flat ui/ collection; component roots live at their module root or in components/.
Do not create all directories or suffix files by template: every one must own actual code.

- components/name/ owns name.tsx, name.types.ts, name.module.css and an explicit index.ts; complex
  children own local components/ and hooks/. Parent composition forwards only required contracts.
- hooks/use-name.ts owns real React synchronization/state logic. Hooks may have local .types,
  .utils and .config peers if needed. Do not move the native high-frequency engine into React hooks.
- name.types.ts owns module contracts; name.config.ts owns stable policy/defaults/labels;
  name.utils.ts owns scoped pure transformations. No generic types.ts/utils.ts/config.ts, catch-all
  dumping grounds or runtime state hidden in config. Stateful algorithms stay explicit classes/factories.
- A child public boundary is any nested directory with index.ts, including components/ and
  modules/ descendants (recursively) and named domain capability roots. Consumers outside a child use its index.ts; child internals never import
  their own/ancestor barrel. Relative imports compose children within the same outer slice; independent
  top-level slices still obey the outer FSD rules. Sibling child modules may depend on explicit public
  APIs when acyclic; orchestration composes their lifetimes. No deep private sibling imports or exports
  that re-expose private child files. Root-owned foundational contracts may be imported inward directly.
- Extract by responsibility/state owner: tool controls, import dialog/recovery/status, cursor visuals,
  document validation/snapshot conversion, worker transport/upload, selection contacts/transactions,
  region normalization/bounds/intersection/grouping. Splitting one function into arbitrary fragments
  or forwarding every method to a new bag of the same state does not satisfy decomposition.
- Keep one authoritative mutable owner per interaction/session; helpers receive narrow ports/context,
  never a new global store. Preserve weak geometry-cache ownership, cancellation generations, writer
  drain-before-lease-release and cached UI snapshots. React component extraction adds no DOM wrappers
  unless the existing layout requires them.
- File size is a review signal. Review production files above300lines for mixed responsibilities;
  do not split a cohesive algorithm or state machine merely to satisfy a line limit. Tests retain
  behavior assertions and colocate with the module they exercise; fixtures may have separate owners.

## Types, code shape and composition

- Source files/directories use kebab-case; component exports PascalCase, one component per file.
- Authored components are arrow functions typed React.FC<Props>. Props live in root-qualified
  `ComponentTypes.Props` in colocated root-component.types.ts; use type, not interface.
- Access props.name; retain one named object for object-valued hook results. useState tuples are
  allowed. Default-valued props and purpose-named rest props in thin wrappers are narrow exceptions.
- Effect callbacks are named functions ending Fx. No nested components or JSX-valued helper
  constants; split by cohesive responsibility, not arbitrary line counts.
- Group pure helpers/constants in owner-prefixed objects; shared/lib public utilities expose one
  namespace-style object. Stateful domain classes remain classes; do not disguise them as globals.
- Keep mutable editor state outside React. Cached immutable UI getSnapshot/subscribe projection
  contains settings/status/flags only, never Scene/points. readBoardSnapshot is a separate on-demand
  capture. No per-pointer React state, full raw-point clone, or new global store.
- Synchronous guards remain authoritative before React paints. Do not mechanically remove refs.

## Platform and lifecycle

- Browser globals, storage, file/clipboard APIs, timers/RAF, worker creation and DOM manipulation
  belong to concrete owning adapters/native runtime files, not views or pure board modules.
  Allowlist exact files/capabilities; never an entire layer/lib folder. Resolve lexical globals:
  a local BoardSnapshot variable named document is not DOM access.
- Change18 adds explicit UI-free secondary public entries `features/board-document/worker.ts`
  and the native image cache's `images/worker.ts`. Own/ancestor-barrel and other private-boundary
  checks still apply. Workers remain React/DOM/clipboard/RAF-free. Only named selection-PNG raster
  and clipboard-image-preflight roots may reach their exact reviewed Canvas owners; a normal
  document worker cannot gain Canvas by importing one of those files.
- The native clipboard owner negotiates editable fragments and PNG for keyboard/menu operations.
  Feature codec/jobs own strict portable payloads, chunked serialization/reading and embedded
  image preflight; entity selection owns generation-safe capture/removal and ordinary insertion.
  Clipboard/insertion state is a coarse projection; it never exposes raw scene data to React.
- Feature-owned catalog2 holds board appearance, with pure deterministic assignment/validation.
  Library repository owns the atomic catalog1 backup/upgrade; read-only views derive covers
  without writes. Sidebar covers are plain Lucide SVG/color presentation, with no document
  loading, raster workers or URL/cache lifetime. Draft editor state belongs to its child view;
  only the library session publishes committed metadata after durable completion. Sidebar and
  its protected dialog share dismissal ownership; unmount releases only its owned modal flag.
- Ordered BoardItem collections discriminate ink and image; raw points/local masks and immutable assets are separate from affine placement. Wire schema4 uses items plus a deduplicated asset table; runtime strokes collection name remains for native API compatibility. Worker geometry jobs omit image bytes; only durable/explicit asset validation uploads bounded payload chunks. Generation-owned image caches release unreferenced resources and late decodes.
- Core live geometry provides readonly geometry/stable-prefix boundary; native painter owns
  Path2D prefix/cache and draws one combined path. Keep weak ownership, sealing and O(new samples).
- Workspace/tab owns clipboard and one feature library session. The library holds origin authority, catalog and one board-scoped document session/durable writer. Board sessions borrow authority; only the library releases the lease after draining children. Editor generation owns
  renderer, semantic input, selection worker and DOM subscriptions. Import replaces only editor
  generation. Sessions preserve raw schema metadata for atomic schema2/3/4 recovery; library bootstrap preserves exact raw pre-library data.
- Dispose cancels interaction/selection/frames/listeners, drains persistence/repository, then
  releases lease. StrictMode startup waits prior disposal. Selection cancellation never closes
  the durable writer. Factories inject dependencies; one explicit owner composes cleanup.

## Styles and accessibility

- Colocate CSS Modules. Global reset/fonts/theme/tokens are app-owned. Components consume semantic
  tokens, preserve current dimensions/colors/focus and accessible names; no visual redesign.
- Extract genuinely repeated Button/field primitives; board cursor/canvas stay domain-owned.
- Keep domain persisted INK value independent of UI theme. Dynamic viewport/cursor CSS properties
  are presenter-owned data, not a token override.
- Preserve keyboard/pointer ownership, text-input shortcuts, focus return, dialog and read-only
  behavior; controls/status cannot resize the canvas unexpectedly.
- Use one blank line after the import group; between types/functions and other module sections;
  between constructors, methods, accessors and arrow actions; around guards, loops, try blocks,
  multiline operations and the final return. Keep related simple declarations/assignments,
  import/barrel groups, type/object data properties and overload signatures compact. Retain extra
  semantic grouping where useful; do not insert a blank line between every statement. Own-line
  comments remain attached to the following block, inline comments to their statement.
- Separate CSS rules with one blank line; keep declarations inside a rule together.
- npm run format applies Prettier, the syntax-aware JS/TS spacing pass, then Prettier again.
  npm run lint and format:check reject missing structural spacing. The pass adds whitespace only;
  strings/templates/JSX text and comment contents are never rewritten.
- Repository Prettier/EditorConfig commands own formatting; exclude generated data/artifacts and
  Markdown. Architecture policies have positive/negative fixtures and no blanket disables.

## Tests and delivery

- Preserve all existing behavioral assertions; update constructors/imports for injected contracts.
- E2E specs import test only from fixtures and use domain fixtures. Fixtures own contexts/data and
  cleanup; Page Objects own low-level actions/assertions. Normal smoke and fault injection are
  separate; expected faults cannot mask unexpected errors.
- Playwright uses isolated contexts, one worker, dedicated4185 preview, /penable/ base and
  reuseExistingServer:false. Never use the person's Playwriter profile/storage for automated E2E.
- Playwriter remains first for interactive UI evidence. Check desktop/narrow, fresh console,
  actual Pages worker paths, native raster and paired performance on the real refactored engine.
- Gates add formatting, architecture policies/self-tests and browser smoke; Full Gate/local ship
  remain mandatory. Release is separate; Wacom/GPU/browser post-GC claims need actual evidence.

## Writing instruments and vector templates

SPEC5.19 extends the existing scene with styled ink and one discriminated template item. Pure
writing policy, pressure geometry and versioned mathematical layout belong to entities/board.
Template layout declares bounded path/ellipse/text primitives; it never invokes native Canvas
or text metrics. Native painters own resolution-independent replay on editor and PNG-worker
contexts. Glyph layout/bounds belong to the generator; browser text painting stays native-owned.

The widget composes per-instrument settings and template configuration panels through existing
coarse model subscriptions. Placement preview is transient, uses the existing live layer and
current world transform, and never enters document history or persistence before commit.
One placement creates one item and one history action. Shapes remain immutable configurations
with affine placement/local clips; exact fragments share source lineage instead of duplicating
hundreds of independent primitives. Settings changes never reinterpret earlier ink.

Document schema5, strict style/template validation, old-fragment compatibility and atomic raw
before-schema5 recovery belong to board-document. Existing bounded Worker transport/session
ownership remain authoritative. Raster-worker exceptions name only the exact pressure/template
painters; document workers cannot import native painting, DOM, UI or React.


## Touch and adaptive viewport ownership

Pure entities/board/touch owns contact state, midpoint-anchored pan/pinch, rebase and quarantine.
Native touch-binding owns DOM pointer capture/coordinates and composes pen/eraser/selection
through narrow ports. PointerBinding remains the single owner of listeners; touch adds only
an exact DOM capability owner, no shared global listeners. Immediate touch ownership guards
wheel, keyboard/history, selection commands and minimap before React updates. Pen preempts
finger interactions; held contacts stay quarantined until lifted.

Workspace owns transient fingerInput, retained across board sessions and reset on reload.
Only coarse settings UI exposes it; gestures and samples never enter React snapshots.
Overlay platform fitting owns visualViewport listeners and CSS usable-height/keyboard-inset
properties, including cleanup. Views consume those properties and safe-area env() insets;
coarse behavior uses media queries, never UA sniffing. Responsive panels cannot resize or
remount the drawing surface. Persisted camera updates retain read-only authority guards.

The bounded WebKit touch project shares domain specs/Page Objects with Chromium. Fixtures own
mobile/coarse options, keyboard viewport simulation, isolated storage and native CDP lifetime.
Synthetic pen events and Linux WebKit are regression evidence, not physical Pencil acceptance.


## Versioned mathematical geometry

TemplateItem.generatorVersion1|2 is authoritative across codec/geometry-only jobs, layout,
bounds/intersections, renderer/PNG, fragment lineage and caching. LegacyTemplates preserves
version1 geometry exactly; no load-time conversion. Schema5 remains the containing format.
The pure template module owns bounded numeric sizing, extracted handwritten glyph metrics and
semantic label bounds. The prepared KleeOne atlas and its license/provenance are static local
assets, not a browser font. Native TemplatePaint owns bounded Path2D glyph caches; SVG scene
replays the same outlines. Generated workload estimates participate in worker routing.

TemplatePreview composes a memoized immutable PreviewScene and a local PreviewCamera. Camera
changes never rebuild scene geometry or write board state. Its exact native PreviewInput
adapter owns capture/keyboard/blur and deduped RAF-deferred ResizeObserver updates; disposal
releases contact, observer and pending frame. React hooks own only subscription/lifecycle and
coarse presentation. Existing layers and exact PNG worker capability boundaries remain.

## Application availability

features/app-availability owns install/offline lifecycle and its coarse UI; app composes it beside
board-workspace without peer imports. Its exact native adapter owns service-worker registration,
install prompt and standalone media events. Views/hooks consume snapshots and actions only.
Build-owned scripts/pwa emits manifest/icons and the complete versioned production shell. Cache
Storage contains app assets only, never document data; SW does not claim clients or skip waiting.
Updates cannot reload an active editor. Existing document sessions/leases retain all authority.
