# Change 47 — Editable clipboard text

## Change Metadata

Branch `feature/47-clipboard-text`. Status: shipped.

## Goal

Paste a quotation from a book or article, annotate it with the pen or highlighter, and return to the editable text later. See [SPEC](../../SPEC.md) §5.29.

## Backlog

- [x] `F1` Add text geometry, selection, transforms and atomic editing to the board entity.
- [x] `F2` Roundtrip text through storage, recovery, workers and editable fragments.
- [x] `F3` Integrate paste, Canvas presentation, editing dialog and localized status.
- [x] `T1` Verify clipboard formats, editing, annotation, portability, offline boot and browser layout.
- [x] `T2` Complete independent review and the Full Gate.

## Files

Board entities, board-document codec/storage/jobs, board workspace native runtime, selection UI, localization, browser tests and current documentation.

## Gate Checks

Use [STACK](../../STACK.md). Smoke uses isolated Windows Chrome with an external article-like source, native clipboard and a fresh production preview.

## Architect Review Notes

- [x] No architect review issues recorded.

## Verification

The local gate passed with 946 unit tests and coverage of all 164 browser scenarios on the same
Pages build. The first browser run passed 163 cases. The clipboard suite passed all 20 after its
obsolete PNG-only hint assertion was updated to the current system-paste message. TypeScript
diagnostics covered the changed source and test files with zero errors or warnings.

## Implementation Notes

- Text-bearing selections that exceed raster limits still support editable clipboard copy and cut.
- The Windows Chrome smoke used the system clipboard with an owned article-like source. On a
  100,000-point fixture, synthetic pen input produced no tasks of 50 ms or more in either sampled
  run, with and without a text block. Physical stylus acceptance remains separate.

## Commit Message

`feat(change-47): paste editable text onto boards`
