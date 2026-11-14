# CHANGE30 — Telegram feedback

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `30` |
| Slug | `telegram-feedback` |
| Status | `verified` |
| Branch | `feature/30-telegram-feedback` |

## Goal

Give visitors an accessible way to contact the owner from Help, using the approved
Telegram account @avatarsikkk. Preserve the existing editor layout and behavior.

## Backlog

### Frontend
- [x] F1 Add the Telegram feedback link below Diagnostics with a Lucide message icon, existing visual tokens, visible keyboard focus and a 44px minimum target; verify desktop/narrow UI — _Depends on:_ —

### Other
- [x] T1 Run applicable Fast/Full gates and automatic local ship — _Depends on:_ F1

## Files

### Create / modify
- src/widgets/board-workspace/components/help-controls/help-controls.tsx and help-controls.module.css
- src/shared/ui/editor-icon/editor-icon.config.ts and editor-icon.types.ts
- DESIGN.md; docs/STACK.md ship status

### Do NOT touch
- Document schema/data, drawing/rendering/input, dependencies and publication.

## Contracts

Existing SPEC5.3/5.14 contextual Help and FRONTEND.md contracts. Approved chat plan:
ordinary anchor to https://t.me/avatarsikkk, target=_blank, rel=noopener noreferrer.

## Gate Checks

Use STACK Fast/Full. Native owned Pages preview: desktop and phone layout, link destination
and external-link attributes, keyboard focus/Escape return, touch target and fresh console.
No bespoke unit tests for a static low-impact link; existing Help/browser regressions apply.
Drawing engine unchanged: reuse Change27 performance/raster evidence, no new ink benchmarks.
Local ship only; Pages release is separate.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Commit Message

```
feat(change-30): add Telegram feedback to Help
```

## Fast verification

Lint/architecture, format check and TypeScript PASS. LSP: no diagnostics in all3 changed TS files.
Context7 quota exhausted; official React/Lucide documentation used as the prescribed fallback.
Native Playwriter confirms Tab focus/visible outline, Escape close/focus return, 44px link target,
correct href/target/rel and no overflow at390px. DevTools fallback confirms desktop and390px
coarse screenshots, real click opens Telegram Contact @avatarsikkk with null opener while the
board stays open; no fresh console warnings/errors. Playwriter screenshot timed out as before.
Design detector: no findings. No bespoke tests for this static link.

## Full Gate — PASS

| Check | Result |
|-------|--------|
| Bootstrap | PASS |
| Frontend build | PASS |
| Pages build | PASS |
| TypeScript / LSP | PASS; no diagnostics |
| Unit suite | PASS;704 tests |
| Lint / architecture / SAST | PASS |
| Formatting | PASS |
| E2E | PASS;110 Chromium/WebKit cases |
| Secrets | PASS;no leaks |
| Dependency audit | PASS;0 vulnerabilities |
| Native smoke / accessibility | PASS; desktop/390px, keyboard focus/Escape,44px target, correct contact in new tab, null opener, clean console |
| Performance / raster | Unchanged-engine Change27 evidence reused;static Help link only |
| Architect notes | 0 unresolved |
| Backend / migrations / formal accessibility audit | n/a/deferred per STACK |
| Release / Pages deploy | Not requested |
