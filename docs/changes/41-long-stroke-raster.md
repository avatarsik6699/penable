# CHANGE 41 — Retained active-ink raster

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `41` |
| Slug | `long-stroke-raster` |
| Title | Retained active-ink raster |
| Status | `feasibility-rejected` |
| Branch | `feature/41-long-stroke-raster` |

## Goal

**Feasibility rejected. No retained-raster production source is included in change42.**

Execute the owner-approved native long-stroke follow-up against published b9898ea. Retain
active-layer pixels outside changed device regions and replay the existing complete vector path
once inside the dirty union. No sampling, geometry, opacity, document-format or quality changes.
Passing raster and native timing feasibility is mandatory before delivery as a long-stroke fix.

## Backlog

### Frontend
- [ ] `F1` Implement renderer-owned active dirty-region state, incremental ordinary/pressure change bounds and safe clipped clear/replay; preserve exact raster and invalidate native paint state. — _Depends on:_ T1
- [ ] `F2` Integrate all lifecycle resets/context restoration and behavioral regressions after feasibility passes. — _Depends on:_ F1, T2

### Infrastructure
- [ ] `I1` Document native evidence, accepted limits and reproducible settled-frame measurements; integrate deterministic raster/work/ownership regressions. — _Depends on:_ F2, T2

### Other
- [ ] `T1` Capture b9898ea baseline and establish actual-renderer parity/settled-frame harness. — _Depends on:_ —
- [ ] `T2` Mandatory feasibility: exact legacy/instrument/new retained-raster comparisons and first3 valid warmed native pairs; ordinary regression budget and 100k ordinary/pressure frame p95<=33ms. — _Depends on:_ F1
- [ ] `T3` Independent review, required tooling and Fast/Full Gate acceptance for automatic local ship. — _Depends on:_ I1

## Files

### Create / modify
- `src/widgets/board-workspace/components/writing-surface/native/rendering/` — active raster owner, painter/renderer, tests and narrow public test entry only when necessary.
- `src/widgets/board-workspace/components/writing-surface/native/bindings/`, `native/editor-runtime.ts` — exact lifecycle/context owners only.
- `src/entities/board/geometry/`, `src/entities/board/writing/` and required public type exports — additive cursor/section metadata, conservative bounds and tests; unchanged geometry.
- `scripts/performance/`, `e2e/` — owned raster/native timing/lifecycle fixtures and Page Objects.
- `scripts/architecture/` — exact capability-owner changes only if necessary.
- `docs/SPEC.md`, `docs/STACK.md`, `docs/KNOWN_GOTCHAS.md`, `docs/performance/41-long-stroke-raster.md` — approved constraints, evidence and reproduction.

### Do NOT touch
- Persisted formats, raw samples, accepted curves/pressure outlines, input ownership, native PNG/minimap behavior, unrelated UI/dependencies or personal data.

## Contracts

See SPEC5.2/5.12 and FRONTEND native/geometry ownership. Activate retained mode at8192 raw
samples with no selection/template overlay. Track old provisional bounds plus newly stable and
current provisional geometry; use64px device tiles with outward integer rounding and2px halo.
Pressure stable cursors must not re-dirty the whole256-section staging buffer on chunk sealing.
One union clip and one existing full-path draw; invalidate LayerPainter state before draw and
after restore. Reset on source/style/profile/transform/backing changes, overlays/fullDirty,
commit/cancel/disposal/context restoration. At most16MiB additional raster cache, zero initially.

## Gate Checks

Standard [STACK.md](../STACK.md) gates plus mandatory feasibility. Baseline source captured in
`.artifacts/change-41/baseline/src`. Native benchmark4180, owned application4220, E2E4185.
Preserve864 legacy/instrument comparisons and add exact retained-vs-full renderer pixels at
crossings/retraces/dots/pressure-only changes, fractional transforms, DPR and chunk rollovers.
Performance attribution includes pointerup plus two settled RAFs; run long operations in-page
and poll, respecting Playwriter's separate30s forwarded-CDP deadline. First3 valid warmed pairs:
ordinary medianp95<=max(1ms,baseline*1.2), 100k ordinary/pressure framep95<=33ms, all100k raw
points and one commit. If parity or native timing fails, do not ship this as the fix; record the
blocker and return to the owner-approved architecture gate. Change42 is a separate independent
document-transport follow-up; final Pages release follows completion of both accepted units.
Hardware Wacom acceptance is reported separately and never inferred from automation.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Native same-Path2D controls reproduce clip-dependent raster differences, including alpha255→114
  inside the dirty rectangle. Full-canvas clip passes; narrow clip and copy compositing fail.
- A full-bounds sentinel control removes the large error but leaves pen/pressure differences
  outside geometric dirty bounds and native100k framep95117.2ms, above33ms. No tolerance was relaxed.
- Prototype retained in local stash a33b1f7508cfb5192fb1a791f9fdbb552d94dfc9 and ignored change41
  artifacts. Source was removed from the active tree before independent change42 implementation.
  Further renderer work requires the separate architecture decision specified by the approved gate.
- The owner selected another architecture preserving quality. The next proposed feasibility
  control uses fresh full-replay native backends; no production backend change is authorized
  by a claimed speedup or enabled in change42. See the performance record for its bounded gate.

## Commit Message

```
perf(change-41): retain unchanged active ink raster regions
```
