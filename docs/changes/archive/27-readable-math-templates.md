# CHANGE27 — Readable mathematical templates

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `27` |
| Slug | `readable-math-templates` |
| Title | Readable mathematical templates |
| Status | `shipped locally` |
| Branch | `feature/27-readable-math-templates` |

## Goal

Implement owner-approved SPEC5.22: readable handwritten math templates, expanded numeric ranges,
separated circle notation and useful previews. Preserve all generator1 content. Baseline1008cec.

## Design References

Existing lighteditor DESIGN.md; approved narrow refinement. Owner chose everylabel/autosize,
required−100…100step1, separate angles/coordinates, tidy handwriting, closeup+whole preview.

## Backlog

### Frontend
- [x] F1 Versioned generator2 layout, bounded numeric autosize, handwritten vector glyphs/metrics, nonoverlap math labels and unit regressions — _Depends on:_ —
- [x] F2 Version-aware runtime/codec/selection/cache/source compatibility, native/PNG glyph replay, generated-workload accounting and readable origin-anchored placement; preservev1 — _Depends on:_ F1
- [x] F3 Adaptive math panel and independent accessible closeup/whole preview, finger/mouse/keyboard pan, circle toggles and draft errors — _Depends on:_ F1,F2

- [x] F4 Resolve WebKit overlay/preview ResizeObserver cycle with bounded deferred fitting and lifecycle regressions — _Depends on:_ F3

### Other
- [x] T1 Domain Chromium/WebKit E2E, exact architecture owners, LSP and Fast Gate — _Depends on:_ F1,F2,F3
- [x] T2 Native visual/raster/performance, independent source/UX/security review, docs and automatic localship — _Depends on:_ T1

### Backend / Infra / Data
None; generator version support extends schema5, no IDB/catalog migration or dependencies.

## Files

### Create / modify
- src/entities/board/templates/** and board.types/public API; version-aware region/selection geometry paths.
- src/features/board-document/{modules/codec,modules/fragments}/**; native source/geometry job version dispatch asneeded.
- src/widgets/board-workspace/components/{pen-toolbar/components/template-panel,writing-surface/native}/**.
- src/shared/lib/overlay/** for new preview sizing integration; src/** scoped colocated regression tests; new glyph outline metadata/license under owningtemplate module.
- e2e/**, scripts/architecture/**, scripts/performance/** as required by new exactowners/fixtures.
- docs/{SPEC,STACK,FRONTEND,KNOWN_GOTCHAS}.md, README.md, DESIGN.md, .impeccable/design.json.

### Do NOT touch
- Legacy v1 rendered geometry/validation; ink pressure/stabilization/hotpath; persistence schema version, IDB/catalog; npm dependencies/lockfile; userorigin storage/tabs; external publication.

## Contracts

SPEC5.22, FRONTEND.md and current codec/worker boundaries are authoritative.

## Gate Checks

STACKFast/Full mandatory. Isolated E2E4185, owned nativePages4207 and perf4180. Verify required
numericexamples/201tickboundary, all glyphs, circle label bounds, v1raster invariance, v2
preview/Canvas/PNG agreement, mobileWebKit previewpan/geometry, mixedversion fragments and reload.
Bounded input/render CPU and normal ink pairedbaseline1008cec; physical iPad remainsmanual.

## Architect Review Notes

- [x] Independent final review PASS. Fractional-step precision fixed with regressions; no remaining source/UX/security/architecture findings.

## Implementation Notes

- Existing mathematical items remain generator1; new math uses2 within schema5. No data conversion, dependencies or lockfile change. No runtime font load; compact Klee atlas includes OFL/provenance.
- Required-range manual step retains every label. Numeric placement anchors zero at the chosen point; large templates intentionally extend outside the view. Whole preview is an overview; Closeup keeps readable detail.
- WebKit exposed a pre-existing shared overlay resize feedback path. Exact RO instrumentation and independent escalation confirmed the owner. F4 defers later fitting through RAF and removes mobile math's self-dependent height cap; errors and staged expansion are resolved without suppressions.
- Context7 monthly quota unavailable; official React/SVG/Playwright/FontTools docs used as fallback. NativeCPU/raster evidence and limitations are in .artifacts/change-27. Physical iPad remains manual; release not requested.

## Commit Message

```
feat(change-27): improve mathematical templates and previews
```


## Full Gate — PASS

Shipped locally2026-11-14: feature/27-readable-math-templates → main (fast-forward), implementation11694ff.

| Check | Result |
|-------|--------|
| Bootstrap / npm ci | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| TypeScript / LSP | PASS;clean changed-file diagnostics |
| Unit suite | PASS;704tests |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;110tests, Chromium and bounded WebKit |
| Secrets scan | PASS;no leaks |
| Dependency audit | PASS;0vulnerabilities |
| Native Pages smoke | PASS;owned4207,desktop/phone/tablet,clean console |
| Accessibility / responsive | PASS;labels/focus/touch targets/keyboard and stable viewport fitting; formal automated audit deferred inSTACK |
| Performance / raster | PASS;3paired CPU runs within budget,0LongTasks;18v1mathhashes and864inkcomparisons exact;newSVG/PNGagreement |
| Independent review | PASS;0unresolved |
| Backend / migrations | n/a;browser-only,unchangedIDB/catalog/schema5 |
| Release / Pages deployment | Notrequested;localshiponly |

Physical iPad/Pencil remains manual. All work/probes preserve ownerlocalhost data.
