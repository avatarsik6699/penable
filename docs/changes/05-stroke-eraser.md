# CHANGE 05 — Ластик целых штрихов

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 05 |
| Slug | stroke-eraser |
| Title | Ластик целых штрихов |
| Status | user accepted — Full Gate PASS |
| Branch | feature/05-stroke-eraser |

## Goal

Стирать целые штрихи пером/мышью, возвращать удаление одной отменой и продолжать
после перезагрузки с сохранённым результатом. Пользователь разрешил предложенный этап
«Продолжай по плану» после ship04.

## Design References

Принятый светлый лист и компактные controls, SPEC §5.3. Две кнопки «Перо / Ластик»,
выбранное состояние и короткая подсказка об удалении целого штриха. Без нового экрана.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Обобщить историю в add/erase операции: загруженная база не undoable как написание, но удаление базы undoable; exact object/order, групповое удаление, redo только после непустой операции — _Depends on:_ —
- [x] F2 Реализовать hit-test отображаемой stabilized geometry, dot/line/quadratic, экранный радиус и swept/coalesced path с кэшем и ограниченной погрешностью — _Depends on:_ —
- [x] F3 Реализовать отдельный EraserInput: single owner, preview без мутации canonical scene, down/move/up/cancel, нет commit при отмене/промахе — _Depends on:_ F1, F2
- [x] F4 Интегрировать preview в renderer и маршрутизацию Surface: корректные RAF/commit queue, busy/history/navigation/import/capture/read-only guards, отмена blur/resize/loss/unmount — _Depends on:_ F3
- [x] F5 Добавить переключение инструментов App/Toolbar, безопасный синхронный выбор/сброс на hydrate, курсор и доступность/подсказку; сохранить настройки пера и компактность — _Depends on:_ F4
- [x] F6 Подключить completed erase/undo/redo к существующему автосохранению, проверить snapshot/flush во время preview и совместимость старых JSON без изменения схемы — _Depends on:_ F4, F5
- [x] F7 По независимому ревью: не разворачивать целиком огромные валидные quadratic-кривые при локальном промахе ластика; отбрасывать ветви по hull bounds и проверять адаптивно с ограничением ошибки без большого массива сегментов — _Depends on:_ F2
- [x] F8 По визуальной проверке: уплотнить горизонтальные промежутки toolbar, чтобы на1440px диагностика не занимала отдельную строку после добавления ластика; сохранить40px targets и narrow wrapping — _Depends on:_ F5

### Infra

- [x] I1 Обновить README/STACK и зафиксировать границы/управление/проверки — _Depends on:_ F6
- [x] I2 Зафиксировать новое правило владельца в AGENTS.md: после реализации и успешных автоматических проверок выполнять локальный ship без отдельной команды — _Depends on:_ —

### Data

None — schemaVersion1 и nativeIDB1 не меняются; автоматические тесты не трогают данные пользователя.

### Other

- [x] T1 Выполнить focused/regression тесты истории, попадания и жизненного цикла, renderer queue, базовое письмо/сохранение; Fast Gate и TypeScript LSP — _Depends on:_ F1, F2, F3, F4, F5, F6
- [x] T2 Проверить в реальном браузере tap/drag/miss/cancel, keyboard/grouped history, zoom/pan, imported baseline, save/reload/JSON, read-only, desktop/narrow/screenshot/console — _Depends on:_ T1, I1
- [x] T3 Пользователь проверяет комфорт ластика и undo/redo на Wacom; не повторять принятую оценку письма без регрессии — _Depends on:_ T2

## Files

### Create / modify

```text
src/drawing/history.ts
src/drawing/history.test.ts
src/drawing/hit-test.ts
src/drawing/hit-test.test.ts
src/drawing/eraser.ts
src/drawing/eraser.test.ts
src/drawing/renderer.ts
src/drawing/renderer.test.ts
src/drawing/types.ts
src/components/WritingSurface.tsx
src/components/PenToolbar.tsx
src/App.tsx
src/styles.css
README.md
AGENTS.md
docs/SPEC.md
docs/STACK.md
docs/changes/05-stroke-eraser.md
.artifacts/change-05/ (ignored evidence)
```

### Do NOT touch

- Archived changes, workflow files, main (до ship), dependencies/lockfile.
- Accepted input.ts, stabilization.ts, geometry.ts and viewport.ts algorithms.
- src/document schema/repository/session/codec: reuse existing completed snapshot/save contract.
- User's actual localhost notes/DB/profile; automated browser uses a task-owned verification origin.
- Partial erasing, pressure width, selection, hardware shortcuts, multi-board, backend/cloud/PWA/export images.

## Contracts

See SPEC §3–§4, §5.3, §5.6–§5.7 and Files above.

## Gate Checks

[STACK.md](../STACK.md) Fast Gate for work. Full Gate only at ship.
Test both accepted pen regressions and eraser cancellation against canonical snapshots.
Use Playwriter first; synthetic input does not prove hardware comfort. Isolate storage test origin
and never overwrite user localhost notes. Browser does not need to rerun unchanged storage fault suite.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Preview is renderer-only because an earlier pending save, visibility flush or export may read
  the canonical document during a gesture. Temporary removal from scene.strokes was rejected.
- History/cache/preview use stroke object identity; numeric IDs can be reused after erasure.
- Native capture tests must activate capture with a move before releasing it; releasing only a
  pending capture does not exercise the lost-capture cancellation path.

## Verification Evidence

- Plan mode: auto→continue. SPEC §5.7 records the approved whole-stroke eraser; design unchanged.
- Fast Gate PASS: `npm run test:unit` —236tests in16files; `npm run lint` and
  `npm run typecheck` PASS. LSP checked12changedTSfiles:0errors,0warnings, one existing
  informational deprecation for `beforeunload.returnValue` in App. No dependencies added.
- Independent review found eager expansion of huge valid quadratics. F7 replaced it with
  query-directed subdivision/hull rejection; two extreme-coordinate regressions pass.
  Targeted follow-up: no remaining findings, including500additional near-curve checks.
- Browser:58distinct latest assertions PASS (62attempts). Playwriter in real Windows Chrome
  covers native mouse contact/grouped drag/capture loss, native keyboard undo/redo/Space/middle
  pan, dots/quadratics/near misses/coalesced/fast-up sweeps, second-pointer rejection,
  blur/cancel/button loss/real resize, synchronous busy guards,25/100/400/800% with pan,
  preview-safe visibility flush, reload/unfinished gesture, undo persistence, schema1JSON
  round-trip, pen after hydration, read-only peer and real versionchange cancellation/export.
- Four initial harness assertions remain in `browser-checks.json`: pending capture was released
  before activation; the25% target-miss fixture legitimately touched a neighboring line; raster
  comparison used different canvas heights caused by export/import notices; a diagnostic pixel
  probe generated Chromium's getImageData readback advisory. Correct trigger/isolated target/
  settled matching layout/fresh unprobed console subsequently passed. No product source changed
  to hide these cases. Details: `harness-notes.json`, `native-capture.json`, `roundtrip-layout.json`.
- Final fresh normal-use console and secondary console: no errors/warnings. Earlier test-only
  readback advisory retained in `runtime-errors.json`; production code has no getImageData.
- Final screenshots inspected: desktop1440×900 has one40px toolbar row; narrow390×844 has
  scrollWidth390, approximately398px writing area, labelled pressed-state tools and40px targets.
  Keyboard focus inspected. Final captures used Chrome DevTools isolated context after two
  Playwriter capture timeouts; read-only escalation confirmed transport/capture uncertainty,
  not a proven product defect. Functional evidence remained Playwriter. `desktop.png`/`mobile.png`.
- User T3 accepted: «Удобно, всё работает» after requested Wacom eraser/grouped undo/zoom trial.
  This does not establish performance at document resource limits or hardware-button support.
- Task-owned127.0.0.1database, tabs and session removed, isolated visual-test page/database removed;
  user localhost notes/tabs and Miro preserved. Existing dev server remains on5173.
- Evidence and source hashes: ignored `.artifacts/change-05/verification.json` and
  `fast-gate.json`. Full Gate, commit, merge, archive and release were not run in work.

## Commit Message

```text
feat(change-05): add whole-stroke eraser with undo
```

## Full Gate — ship05

2026-11-12. Owner requested automatic local ship after successful implementation and automated
checks; this preference is recorded in AGENTS.md. Wacom acceptance was already received:
«Удобно, всё работает». All Backlog items/review notes checked; no product code changed in ship.

| Check | Result | Evidence |
|-------|--------|----------|
| Infrastructure / bootstrap | PASS | `npm ci` in isolated clean copy,47packages |
| Migrations | SKIPPED — no CLI command | IDB/schema unchanged; schema/load covered by unchanged browser evidence |
| Backend test suite | SKIPPED — no backend | n/a in STACK |
| Frontend build / type-check | PASS | `npm run build`, TypeScript then Vite,37modules |
| Frontend unit tests | PASS | `npm run test:unit`,236tests in16files |
| E2E lint / determinism | SKIPPED — no command | No automated E2E runner |
| E2E suite | SKIPPED — no command | Interactive browser evidence is Smoke |
| Smoke | PASS | Existing Vite HTTP200;47source/config hashes unchanged,58distinct latest browser assertions and user acceptance reused |
| SAST | PASS | `npm run lint`; correctness analysis, not a dedicated security audit |
| Secrets scan | PASS | `npm run scan:secrets` on original checkout including untracked source, no leaks |
| Dependency audit | PASS | `npm run audit:deps`,0vulnerabilities |
| Accessibility audit | SKIPPED — no formal command | Manual keyboard/focus/labels/targets/responsive checks passed with Smoke |
| Performance budget | SKIPPED — no numeric target | No end-to-end latency or maximum-scene performance claim |
| Architect Review Notes | PASS | 0unresolved |

Overall **PASS**. CSS8.73kB; JS271.42kB (gzip85.10kB). Clean gate copy removed; logs/receipt
and built files saved in ignored `.artifacts/change-05/ship-gate.json` and `shipped-dist/`.
Existing dev server and user's localhost notes preserved. Local ship only; no release/push/deploy.
