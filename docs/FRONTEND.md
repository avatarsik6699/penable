# Frontend contract

Binding for Penable production source and its test/tooling boundaries. Product behavior lives in
SPEC; commands and gates live in STACK. Approved change11 adapts infraegev2 FRONTEND §§2–4,6,
its reading-position adapter/model split, explicit session ownership and executable policies.
The reference checkout is read-only. Existing visual direction and schema1/2 behavior are retained.

## Layers and public APIs

`app → widgets → features → entities → shared`; imports may skip downward layers.

- app is composition/bootstrap/theme, not document or editor use cases.
- widgets/board-workspace owns tool/surface composition, native Canvas painting/path caches,
  cursor/background/outline presenters and pointer/keyboard/resize bindings.
- features/board-document owns schema DTO/codec, repository/lease, worker protocol/client/entry,
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
- Core live geometry provides readonly geometry/stable-prefix boundary; native painter owns
  Path2D prefix/cache and draws one combined path. Keep weak ownership, sealing and O(new samples).
- Workspace/tab owns clipboard, document session and durable writer. Editor generation owns
  renderer, semantic input, selection worker and DOM subscriptions. Import replaces only editor
  generation. Session preserves raw schema metadata for atomic before-schema2 recovery.
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
