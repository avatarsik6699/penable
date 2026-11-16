# CHANGE 44 — Reliable image insertion lifecycle

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `44` |
| Slug | `image-insertion-lifecycle` |
| Title | Reliable image insertion lifecycle |
| Status | `active` |
| Branch | `feature/44-image-insertion-lifecycle` |

## Goal

Complete the owner-approved lifecycle repair after change43: valid images insert on first attempt
after handwriting/window return, without preparing a selection. Pointer hover/up must not abort
an asynchronous insertion. Acquired images continue across blur/hidden as explicitly selected by
the owner; explicit cancellation and editor authority/generation still prevent stale commits.

## Backlog

### Frontend
- [x] `F1` Add typed committed/cancelled/rejected selection insertion outcomes with exact localized reasons and an image-owned AbortSignal through commit; retain existing boolean APIs and release temporary image resources on cancel/failure. — _Depends on:_ —
- [x] `F2` Separate external input blocking from transient image/clipboard busy state; ignore incidental pointer events during commands, preserve acquired image processing on focus/visibility loss, and retain full explicit/authority/generation cancellation. — _Depends on:_ F1
- [x] `F3` Add integrated and real Worker regressions with large deterministic image data, cold/warm validation, all image entry paths, pointer noise, focus changes, precise rejection and stale/cancel/resource cases. — _Depends on:_ F1, F2

### Other
- [x] `T1` Verify required LSP/browser tools, Fast/Full gates, independent review and native acceptance; ship and release with exact deployment verification. — _Depends on:_ F1, F2, F3

## Files

### Create / modify
- `src/entities/board/selection/`, `src/entities/board/index.ts` — typed insertion results, precise transaction completion and caller cancellation, tests/public exports.
- `src/widgets/board-workspace/components/writing-surface/native/images/`, `native/bindings/`, `native/editor-runtime.ts` and its integration test — image operation lifecycle, input ownership and tests.
- `src/shared/lib/messages/` — only necessary localized image insertion/cancellation reasons, preserving typed descriptors.
- `e2e/images/`, `e2e/data/image-insertion.types.ts`, `e2e/pages/image-insertion-page.ts` — deterministic large PNG, fixture-owned real validate-response gate, native input/actions/assertions.
- `docs/SPEC.md`, `docs/FRONTEND.md`, `docs/KNOWN_GOTCHAS.md`, `docs/STACK.md` — approved focus policy, ownership, recurring cause and verification if needed.

### Do NOT touch
- Renderer change41, document formats, source image bytes/quality, dependencies, unrelated UI, owner notes/origins or arbitrary clipboard content.

## Contracts

See [SPEC](../SPEC.md) §§5.16–5.17 and [FRONTEND](../FRONTEND.md) native/selection/Worker ownership. The approved plan and owner focus-policy choice authorize preserving acquired image processing across blur/hidden, with explicit/generation/authority cancellation remaining decisive.

## Gate Checks

Standard [STACK](../STACK.md) gates. Before-fix reproduction on b4f4e09: deferred real selection validation commits once without events, but pen hover, mouse hover and pointer-up cancel it and resolve false. Joined integration tests must cover that state, not stub insert success. Large noisy PNG base64 must exceed128KiB after clipboard normalization; hold only the terminal response of an actual validate Worker job, leaving ACKs/uploads/native validation intact. Check cold/warm Workers, empty/filled scenes, pen/selection tools and pointer noise. Each of Ctrl+V/menu/file entry gets five repeated insertions, drop a separate case; verify exact bytes, selection, one undo/redo and saved reload.

Separate held-validation scenarios cover Escape/direct cancel/modal/read-only/board generation/disposal, no late commits, canonical/temporary bitmap release and successful retry. Preserve precise localized rejection instead of generic file-retry error. Windows Playwriter uses owned strict4223; E2E owns4185. Manual owner target: five writing/site/screenshot/Alt+Tab/Ctrl+V cycles without selecting a tool, then desktop file insertion. Record manual acceptance separately and honestly.

### Final acceptance —2026-11-16

| Check | Result |
|-------|--------|
| Bootstrap / lockfile install | PASS |
| Frontend and Pages builds | PASS |
| Unit tests | PASS —889 tests in80 files |
| Documentation / historical archive | PASS |
| Lint / architecture / spacing / static checks | PASS |
| Formatting | PASS |
| Type-check / LSP | PASS —23 changed TS files,0 diagnostics |
| Browser suite | PASS —148 Chromium/WebKit tests, including8 large-image lifecycle scenarios |
| Before-fix browser reproduction | CONFIRMED —held real validation plus pointer noise leaves no image on b4f4e09; candidate passes |
| Windows Chrome controlled smoke / feedback / console | PASS —real validation, pointer/focus events, exact900KiB source saved once, selection visible, no console errors |
| Manual screenshot / file insertion | PASS —owner reports all requested insertions succeeded first attempt on final4223 build |
| Secrets scan / dependency audit | PASS |
| Independent review / Architect Review Notes | PASS —R1/R2 fixed and re-reviewed,0 unresolved |
| Performance / resources | Real Worker/ACK and existing bounded document/resource regressions pass; native mixed-task observation and limits recorded below |
| Backend / migrations / container / formal accessibility audit | Not applicable or deferred as declared in STACK |

## Architect Review Notes

- [x] `R1` Reject native clipboard commands while ImageInput owns byte reading/decode, before selection validation starts. Add a delayed-decode regression proving a competing editable-fragment paste cannot commit or collide with the pending image ID; verify the original image still completes once.
- [x] `R2` Strengthen browser acceptance to check each newly inserted asset, selected handles, actual canvas hydration after reload, the normalized clipboard size threshold and insertion on an empty board.

## Implementation Notes

- Context7 requests were quota-blocked; official Playwright/Vitest documentation and browser-platform references supplied API guidance.
- Owner acceptance on2026-11-16: after requesting five handwriting/site-screenshot/Alt+Tab/Ctrl+V cycles without preparing a selection and a desktop-file insertion on the final4223 build, the owner reported "Все вставки с первой попытки". This confirms the requested manual sequence, not all possible driver/browser combinations.
- A passive Long Task observer during that mixed manual sequence recorded one53ms task, with no console errors. Concurrent E2E activity and unlabelled native actions prevent attributing it to image insertion or treating it as an isolated latency benchmark. No renderer or image-quality algorithm changed.

## Commit Message

```
fix(images): preserve pending insertions across pointer events
```
