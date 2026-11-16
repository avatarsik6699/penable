# CHANGE 43 — Reliable external image paste

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `43` |
| Slug | `image-paste-reliability` |
| Title | Reliable external image paste |
| Status | `active` |
| Branch | `feature/43-image-paste-reliability` |

## Goal

Diagnose and fix external screenshot/image insertion failing on the first Ctrl+V or menu Paste,
then succeeding after several attempts in Windows Chrome/installed app. Preserve editable
Penable clipboard data, image validation, document authority, cancellation and one undo action.

## Backlog

### Frontend
- [x] `F1` Reproduce the clipboard read/image insertion failure and repair the confirmed operation or format-negotiation defect in the native owner. — _Depends on:_ —
- [x] `F2` Add regression coverage for first-attempt keyboard/menu external image paste and the verified failure/recovery path; retain own-format, denial, stale-data, cancellation and no-double-insertion checks. — _Depends on:_ F1
- [x] `F3` Handle the observed Windows native event with Files while async read returns opaque items: consume only its same-event PNG/JPEG snapshot under the clarified SPEC guards; give opaque menu reads a bounded retry and Ctrl+V guidance. — _Depends on:_ F1

### Other
- [x] `T1` Verify with required tools, native owned browser smoke, independent review and standard gates; record exact cause and remaining Windows clipboard acceptance. — _Depends on:_ F1, F2, F3

## Files

### Create / modify
- `src/widgets/board-workspace/components/writing-surface/native/clipboard/` — clipboard operation and unit regressions.
- `src/widgets/board-workspace/components/writing-surface/native/images/`, `native/editor-runtime.ts`, `native/commands/` — only confirmed insertion/integration defects if needed.
- `e2e/fixtures.ts`, `e2e/pages/board-clipboard-page.ts`, `e2e/editor-ux.spec.ts` — isolated clipboard fault/native regression cases.
- `docs/KNOWN_GOTCHAS.md`, `docs/STACK.md` — only recurring diagnosis or smoke origin instructions if needed.
- `docs/SPEC.md` — clarify same-native-event snapshot handling for the observed opaque Clipboard API result, retaining explicit-denial and editable-format safeguards.

### Do NOT touch
- Renderer change41, document formats, dependencies, unrelated UI, owner notes/origins or clipboard contents outside an explicit test operation.

## Contracts

See [SPEC](../SPEC.md) §§5.16–5.17 and [FRONTEND](../FRONTEND.md) native ownership and browser-test boundaries. Existing fail-closed own-format/permission rules remain authoritative; F3 clarifies the native image behavior requested by the owner.

## Gate Checks

Standard [STACK](../STACK.md) Fast/Full gates. Owned Windows Chrome reproduction on strict4221 and controlled smoke on strict4222 with isolated test data; E2E owns4185. Distinguish real clipboard observation from injected failures. No retries or larger test timeouts to conceal a defect. Preserve image bytes, selected insertion, undo/redo/reload and empty/corrupt/permission feedback. Physical OS screenshot acquisition remains separate if not reproduced directly.

### Final acceptance —2026-11-16

| Check | Result |
|-------|--------|
| Bootstrap / lockfile install | PASS |
| Frontend and Pages builds | PASS |
| Unit tests | PASS —856 tests in77 files, including36 clipboard cases |
| Documentation / historical archive | PASS |
| Lint / architecture / spacing / static checks | PASS |
| Formatting | PASS |
| Type-check / LSP | PASS —5 changed TS files,0 diagnostics |
| Browser suite | PASS —140 Chromium/WebKit tests |
| Windows Chrome controlled smoke / feedback / console | PASS —owned4222 fixture, no console errors |
| Windows screenshot paste | PASS —owner reports first-attempt Ctrl+V on candidate4221 |
| Secrets scan / dependency audit | PASS |
| Independent review / Architect Review Notes | PASS —R1 fixed and re-reviewed,0 unresolved |
| Backend / migrations / container / formal accessibility audit | Not applicable or deferred as declared in STACK |
| Performance | No renderer/per-sample changes; native clipboard acquisition bounded to2attempts |

The externally interrupted Full Gate was not counted. The complete rerun passed every row.

## Architect Review Notes

- [x] `R1` An opaque native event without a supported File must get the same bounded fresh read as menu Paste; do not stop merely because the action came from a paste event. Preserve first-result same-event File insertion.

## Implementation Notes

- Native Windows Chrome reproduced a supported PNG File (1,680,642 bytes and PNG signature) in the paste event while the successful async read returned one item with no types. The clarified fallback deliberately uses that native-event snapshot only; it never asserts identity with a later clipboard state or retains tab cache.
- Owner acceptance on2026-11-16: the same Windows Chrome test board inserted the newly copied image on the first Ctrl+V attempt ("Вставилась с первой попытки"). This confirms that keyboard path; opaque menu clipboard guidance remains an explicit platform limitation.
- Context7 lookup was quota-blocked; current W3C Clipboard API, official Playwright and Vitest docs supplied API references. Native input/channel observations are separate from injected transient/opaque regressions.

## Commit Message

```
fix(clipboard): make external image paste reliable
```
