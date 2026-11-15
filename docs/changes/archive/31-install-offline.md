# CHANGE 31 — Installation and offline use

## Change Metadata

| Field | Value |
|---|---|
| Change | 31 |
| Slug | install-offline |
| Status | `shipped locally` |
| Branch | feature/31-install-offline |

## Goal

Install penable and reopen it without internet after online preparation. Preserve notes and safe updates. See SPEC5.23.

## Backlog

### Frontend
- [x] F1 Implement production offline shell, manifest/icons, safe update lifecycle and compact install/offline controls — _Depends on:_ —

### Other
- [x] T1 Add isolated offline/update/failure regressions, native visual/console checks, documentation and independent review; run Fast Gate — _Depends on:_ F1
- [x] T2 Run Full Gate and automatic local ship — _Depends on:_ T1

## Files

### Create / modify
- src/features/app-availability/**; src/app/app.tsx
- scripts/pwa/**; vite.config.ts; index.html
- e2e/fixtures.ts; e2e/pages/app-availability-page.ts; e2e/offline/fixtures.ts; e2e/offline/offline.spec.ts
- scripts/architecture/policy.mjs and focused policy tests if needed
- README.md; docs/SPEC.md; docs/STACK.md; docs/FRONTEND.md; docs/KNOWN_GOTCHAS.md; DESIGN.md

### Do NOT touch
- Drawing/input/geometry, persistent schemas, existing notes, release/publication.

## Contracts

See docs/SPEC.md5.23, docs/FRONTEND.md and Files above.

## Gate Checks

Existing STACK Fast/Full. Native isolated Pages preview4208, never owner's5173 data.
Offline preparation must include lazy workers. Test safe waiting/activation and failed upgrade
with owned SW fixture assets; do not replace existing assertions or mask console errors.
Drawing unchanged; reuse existing engine raster/performance evidence, inspect ordinary input
and absence of app-driven reload. Root production build and Pages build both required.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Commit Message

```
feat(change-31): add installation and offline app shell
```

## Fast verification and review

PASS: lint/architecture/self-tests, formatting, typecheck,704 unit tests; LSP no diagnostics in
availability module, App, Vite config and new E2E files. Six real Chromium offline/install/update
regressions pass. Native Playwriter screenshots desktop1440×900, phone390×844 and320×740;
44px trigger, no narrow overlap, Escape closes/focus returns, no fresh warnings/errors. Browser
offers native install action. OS install and physical iPad remain manual. Independent source
review found deployment-skew risk; per-file integrity now rejects it atomically, tested with
HTTP200 mismatched HTML. Review has no remaining blockers; Fallow2 judgments accepted.
Existing engine/raster evidence reused (no drawing change). Initial async test wait race fixed
and recorded in KNOWN_GOTCHAS; no retries/claim/skipWaiting workaround.

Worker-failure test isolation: the three intentional network-fault fixtures explicitly remove
only optional serviceWorker support before startup, preserving every original error/retry/ink
assertion. All3 focused cases pass. Dedicated offline fixtures retain real native SW support.
Independent follow-up review accepts the isolation and native update-state observation.

## Full Gate — PASS

| Check | Result |
|---|---|
| Bootstrap | PASS; npm ci |
| Root production build | PASS; root manifest/id/scope/HTML/SW base asserted |
| Pages build | PASS; /penable/ manifest/cache/worker paths exercised |
| TypeScript / LSP | PASS; no diagnostics in changed TS files |
| Unit suite | PASS;704 tests |
| Lint / architecture / SAST | PASS;59 architecture and15 spacing self-tests |
| Formatting | PASS |
| E2E | PASS;116 Chromium/WebKit cases, including6 new offline cases |
| Secrets | PASS;no leaks |
| Dependency audit | PASS;0 vulnerabilities |
| Native smoke / accessibility | PASS; desktop/390px/320px screenshots,44px controls, Escape/focus, clean console; development has no manifest/SW |
| Performance / raster | Existing unchanged-engine evidence reused; no input/rendering changes |
| Architect notes / independent review | 0 unresolved; source and focused acceptance reviews complete |
| Backend / migrations / formal accessibility audit | n/a/deferred per STACK |
| OS installation / physical iPad home screen | Not manually verified |
| Release / Pages deploy | Not requested |

Initial Full Gate surfaced3 existing worker-fault tests masked by successful caching. Targeted
fixture isolation fixed those without changing their assertions; all116 pass in final full run.
Other unchanged production gate evidence retained from the same source/build/dependency inputs.
Build retains the existing advisory chunk-size warning; it is not a gate failure.
