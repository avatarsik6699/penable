# CHANGE 14 — Визуальный макет редактора

## Change Metadata

| Field | Value |
|---|---|
| Change |14|
| Slug |editor-design-mockup|
| Status |shipped locally|
| Branch |feature/14-editor-design-mockup|

## Goal

Подготовить отдельный браузерный макет с плавающей верхней панелью для визуального обсуждения.
Рабочий редактор, данные, публичные API и текущая утверждённая дизайн-система не меняются.
Макет — предложение; реализация приложения будет отдельным change после выбора владельца.

## Design References

User approved plan: one light Operate concept inspired by Miro/Notability, floating horizontal dock,
inline pen width and click-to-open stabilization. Current light paper/blue accent remain authority.
Desktop1440×900 and1280×720; no mobile redesign in this proposal.

## Backlog

### Frontend

- [x] F1 Implement isolated HTML/CSS/SVG mock with synthetic handwriting, floating tool dock and board/status/zoom/help controls; coherent typography/icons/states — _Depends on:_ I1
- [x] F2 Five demonstrative states: writing, pen parameters, selected region/actions, board menu, save error/recovery; no application or storage access — _Depends on:_ F1

### Infra

- [x] I1 Record product context/proposal brief, define mock-only serve/format/lint commands and branch — _Depends on:_ —
- [x] I2 Capture PNGs writing/pen/selection at1440×900 and inspect1280×720; bounded design detector and independent visual review — _Depends on:_ F2

### Other

- [x] T1 Check isolated interactions/keyboard/layout/contrast and<10%main chrome footprint; preserve source and production bytes, Full Gate/local ship — _Depends on:_ I2

## Files

Create docs/design/editor-v1/, docs/PRODUCT.md and this change. Parent owns mock HTML/CSS/JS,
package/STACK/README, browser/env/Git/gates. A bounded worker may own assets/scene.svg only.
Do not modify src/, app API/data formats/real storage or current SPEC5.3. Proposal is not approval.

## Contracts

Approved chat plan and docs/design/editor-v1/BRIEF.md. Retain project workflow and source architecture.
No new product tools, collaboration, account, note library, dark theme or functional drawing engine.

## Gate Checks

STACK Fast/Full plus mock preview4190, native browser inspections at both desktop sizes, five states,
focus/menus/sliders, no unexpected console/network calls. Original production src must match main
and final Pages bytes must match the pre-change built artifact. Physical hardware/performance
remeasurement inapplicable to static mock; preserve prior engine evidence.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Production src/, SPEC5.3 and lockfile are unchanged. Mock uses native HTML/CSS/JS and same-origin
  bundled Caveat font under SIL OFL1.1; synthetic handwriting is not real engine acceptance.
- One bounded detector run was DEGRADED: optional HTML parser modules unavailable, regex fallback.
  Sole advisory was the actual canvas grid; this is intentional product paper, not decorative layout.
  Browser separately checked contrast6.0+ for accent/text and both viewport geometries.
- Independent fresh-context finish review: disposition `ship`, no material fixes. Mock-scoped DESIGN
  documents a proposal only. Native Chrome smoke covers five states, keyboard/Escape focus return,
  sliders, outside close, contextual tools, lasso/background preview and demo recovery; no external
  requests or JS errors. Chrome occupies4.1% at1440×900 and5.7% at1280×720.
- Deliverable PNGs are exact1440×900 product crops. Gallery state controls remain outside product.
  No physical input/performance remeasurement is claimed for this static artifact.

## Commit Message

```
feat(change-14): add floating editor design mockup
```


## Full Gate — PASS

Clean snapshot `/tmp/penable-change14-gate-0yo277km`; application source matches the prior main,
and final Pages HTML, JS, CSS and module-worker bytes match the prior production artifact exactly.

| Check | Result |
|---|---|
| Bootstrap / npm ci | PASS |
| Root build / Pages build / typecheck | PASS |
| Unit tests | PASS420 /25files |
| Oxlint / architecture graph/platform/shape | PASS223 source+E2E files; mock JS also linted |
| Architecture checker self-tests | PASS52 |
| Spacing / formatting | PASS15 fixtures; source and mock formatted |
| Isolated Pages E2E | PASS10 |
| Mock native Chrome smoke | PASS five states, sliders, focus/keyboard, contextual controls, error/retry; clean console, no external requests |
| Mock layout / accessibility | PASS1440×900 and1280×720; no chrome overlaps/clipped panels;4.1–5.7% chrome; text/accent contrast>=5.98:1; formal audit deferred per STACK |
| Independent finish review | disposition: ship; no material fixes |
| Design detector | DEGRADED regex fallback; one intentional actual-canvas-grid advisory; full HTML parser unavailable |
| Secrets / dependency audit | PASS0 /0 |
| Production raster / performance | Unchanged source and exact output bytes; no new hardware/performance claims |
| LSP | n/a; no TypeScript/Python files changed |
| Backend / migrations / containers | n/a |
| Architect Review Notes |0unresolved |
| Release | Not requested; local ship only |

Implementation commit0778d8d; merged fast-forward to local main. No push/deploy.
