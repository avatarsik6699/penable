# CHANGE 08 — Точное выделение фрагментов полотна

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 08 |
| Slug | canvas-selection |
| Status | active |
| Branch | feature/08-canvas-selection |

## Goal

Согласованный план принят: точная рамка/лассо с разрезанием окрашенных штрихов,
базовые edit-операции, edge-pan, fit-all, отдельный прозрачный PNG. Качество письма и
существующие данные сохраняются. Только local ship; release отдельный.

## Design References

Существующий светлый компактный UI, SPEC5.3; выбранный пользователем набор операций Paint.
Не менять визуальный мир; новые действия — out-of-flow, без изменения bounds полотна.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Векторные regions/lineage/translation и точный visible footprint; immutable sources, normalized masks, caps, dots, holes, limits — _Depends on:_ I1
- [x] F2 Атомарная replacement history: move/cut/delete/paste/duplicate, identities/order/redo/no-op — _Depends on:_ F1
- [x] F3 Renderer clips/union siblings/no seams, видимые bounds и fragment-aware eraser; preview без snapshot мутаций — _Depends on:_ F1, F2
- [x] F4 Selection controller: rectangle/lasso, fixed membership, owner/cancel/read-only, commands/clipboard/nudges, limits before mutation — _Depends on:_ F1, F2, D1
- [x] F5 UI/Surface/App integration: tool+shape/actions, stable cursor, focus, keyboard/modal/busy, overlay hit gating — _Depends on:_ F3, F4, D2
- [x] F6 Edge-pan32/600, idle selection navigation, cancel viewport restore, fit visible ink48px and zoom clamps — _Depends on:_ F4, F5
- [x] F7 Separate transparent vector PNG2x, size budget, clipboard write error/download fallback, async lifetime guards — _Depends on:_ F3, F4, F5

### Data

- [x] D1 Codec schema2 + schema1 compatibility, deep clone/source consistency/clip topology/limits and JSON roundtrip — _Depends on:_ F1
- [x] D2 Atomic before-schema2 backup on first upgrade write/import, separate before-import, session/recovery/UI upgrade copy — _Depends on:_ D1

### Infra

- [x] I1 Add exact polygon-clipping0.15.7 dependency and update STACK contract — _Depends on:_ —
- [x] I2 README/SPEC/STACK final docs and user controls/recovery explanations — _Depends on:_ F5, F6, F7, D2

### Other

- [x] T1 Fast Gate, unit/regression tests, changed-file LSP and independent review — _Depends on:_ F1, F2, F3, F4, F5, F6, F7, D1, D2
- [x] T2 Browser: partial ink/slivers/eraser/seams/zoom/DPR, commands/cancel/navigation/PNG/read-only, migration abort/reload/recovery, desktop/narrow/console — _Depends on:_ T1, I2
- [x] T3 Request real Wacom/Windows PNG trial; record reply or UNVERIFIED; do not block owner-authorized local ship merely awaiting reply — _Depends on:_ T2

## Files

Create/modify: src/drawing/types.ts, new regions/selection/clipboard/PNG helpers and tests;
history/renderer/hit-test/eraser/input/cursor/viewport/shortcuts and affected tests;
src/document/{types,codec,indexeddb,session,stroke-ids}.ts and tests;
src/components/{WritingSurface,PenToolbar,StoragePanel}.tsx, optional SelectionToolbar.tsx;
src/App.tsx, src/styles.css; package.json/package-lock.json; README, docs/SPEC, docs/STACK,
this change; ignored .artifacts/change-08. Source helpers may be split within drawing for ownership.

Do not touch: accepted stabilization/curve algorithms, old archive/playbooks, hosting/workflow,
user localhost/public notes/profile/clipboard, main outside ship, external image import,
resize/rotate/invert/crop/multiple notebooks, backend/PWA or unrequested release.

## Contracts

SPEC3–4 and5.9, STACK. All new schema/geometry scope explicitly approved in preceding plan.
One implementation writer owns source; parent owns package/docs/Git/env/browser/gates;
independent reader reviews final integration. No child delegation.

## Gate Checks

[STACK](../STACK.md) Fast/Full Gates. Baseline252tests/17files. Own127.0.0.1 origin only,
guard cleanup; no refresh of user notes during development. Playwriter first; known capture
limitations may justify isolated DevTools for final visual evidence. Offscreen readback contexts
avoid test-only Chromium warnings. Real clipboard permissions/hardware are separate acceptance.

## Architect Review Notes

- [x] R1 Core review: ordinary50-point width2 handwriting must not throw during selection; avoid unioning polygonized whole-ink capsules as a prerequisite for mask operations.
- [x] R2 Preserve subpixel painted slivers and outside circular arcs: approximate/inscribed footprint emptiness must never drop real ink or a remainder.
- [x] R3 Reject distant strokes by conservative broadphase and cache by immutable source; selecting empty remote area must not polygonize10k/30k-point strokes synchronously (~1.2/3.1sec reproduction).
- [x] R4 Atomic replacement must honor candidate order even when references are reused (history.replace([b,a]) from[a,b]); retain exact undo/redo order.

- [x] R5 Integration review: reject/cancel chorded mouse/pen barrel buttons and ignore nonprimary pointer-up in selection, preserving original input contract.
- [x] R6 Integration review: block arrow nudges while navigation owns a Space/middle-button pan; share authoritative busy ownership.

- [x] R7 Integration review: reserve IDs once per selection/copy batch (10k→20k dot duplication took8.3sec from repeated full ID scans); keep MAX_STROKE_ID wraparound and preflight obvious budgets.

- [x] R8 Browser UI: at390x844 selection panel height220px covers the selected ink after fit-all (center hit lands on panel), preventing direct drag. Make default bar compact with collapsible actions; preserve canvas bounds, accessible Escape/outside/command focus and cursor overlay gating.

## Implementation Notes

- Independent staged review resolved R1–R8; the last UI correction collapses secondary commands to keep selected ink reachable on narrow screens.
- Browser receipt `.artifacts/change-08/verification.json` records exact raster comparisons, real IDB abort/reload/recovery, commands/navigation/fragment erasure and PNG adapter checks. Initial harness readback differences and transient pre-reload HMR errors are retained separately; final runtime is clean.
- Playwriter screenshot transport timed out; isolated Chrome DevTools supplied desktop/narrow visual and actual DPR2 evidence. User localhost/public notes and OS clipboard were not modified by automation.
- Wacom/Windows clipboard trial requested; currently UNVERIFIED. Synthetic/native mouse checks and injected clipboard success/denial do not certify hardware or OS paste behavior.
- Local ship only; no push or Pages deploy in this change.

## Commit Message

```text
feat(change-08): add precise canvas selection and fragment editing
```
