# CHANGE 12 — Читаемые смысловые блоки

## Change Metadata

| Field | Value |
|---|---|
| Change |12|
| Slug |code-spacing|
| Status |active|
| Branch |feature/12-code-spacing|

## Goal

Разделить смысловые части исходников пустыми строками и сохранить это оформление при дальнейшей
работе. Исправить плотное расположение импортов, объявлений, методов и блоков управления потоком.

## Backlog

### Frontend

- [x] F1 Add readable blank lines across source, styles and repository test/tooling code, without changing tokens or runtime behavior — _Depends on:_ I1

### Infra

- [x] I1 Add a small TypeScript syntax-aware spacing formatter/check, wire existing format/lint commands and document exact conventions; preserve comments, strings, templates and compact related groups — _Depends on:_ —

### Other

- [x] T1 Verify formatter safety/idempotence, unchanged source semantics, Fast/Full Gates and automatically ship locally — _Depends on:_ F1, I1

## Files

src/, scripts/, e2e/, package.json, docs/FRONTEND.md, docs/STACK.md and this change.
No product behavior, new dependencies, schema changes, backend, publishing or reference-project changes.

## Contracts

SPEC5.12, FRONTEND, STACK. SPEC remains sufficient; this refines code presentation only.
One blank line at meaningful boundaries, no blanket blank line between every statement.

## Gate Checks

STACK Fast/Full. Verify production source changes are whitespace-only and build bytes unchanged
where applicable. New formatting-tool regression cases cover comment ownership, literal content,
syntax boundaries and repeated formatting. UI/performance changes are out of scope. CSS whitespace changes scoped class hashes; check the
new production build in browser. Reuse engine performance evidence only if native benchmark bytes
match change11 exactly.

## Architect Review Notes

- [x] R1 Keep constructor overload signatures compact alongside function/method overloads; covered by a regression fixture.

## Implementation Notes

- Existing JS/TS changes are whitespace-only: parser-token comparison of110 changed source/test/tooling files matches093e8ae (change11); git diff ignoring whitespace/blank lines is empty. Strings, regex, templates and comments retain their content. Native benchmark JS is byte-identical to change11 (b55f9e18…); performance/raster evidence remains applicable without rerunning timings.
- CSS spacing changes scoped class hashes, so Pages JS/CSS artifact names change even though rules/declarations are identical. New production build passes9 browser regressions including100k-point selection/save/reload and Playwriter desktop/narrow inspection. Formatter safety/idempotence covered by15 focused tests; no dependencies added.

## Commit Message

```
chore(change-12): improve code block spacing
```


## Full Gate — PASS

Clean source snapshot; Pages HTML/JS/CSS/worker bytes match the browser-tested new build.

| Check | Result |
|---|---|
| npm ci | PASS |
| Root / Pages builds / typecheck | PASS |
| Unit tests | PASS416 |
| Lint / architectural policies | PASS;36 policy fixtures |
| Spacing / formatting | PASS;15 spacing fixtures; repeat formatting stable |
| Pages E2E | PASS9, including100k-point worker selection/save/reload |
| Interactive smoke / accessibility | PASS desktop/narrow, focus badge, labels and clean console; formal audit deferred per STACK |
| Secrets / dependency audit | PASS0 /0 |
| Source semantics | PASS110 unchanged parser-token streams; whitespace-only tracked source diff |
| Performance / raster | Native engine JS byte-identical to change11; reuse its passing performance/raster evidence |
| LSP | Source/E2E no errors or warnings; same6 informational source diagnostics |
| Independent review | PASS constructor-overload grouping fixed and tested |
| Architect Review Notes | PASS0 unresolved |
| Backend / migrations / containers | n/a |
| Release | Not requested; local ship only |
