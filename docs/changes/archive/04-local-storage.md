# CHANGE 04 — Локальное сохранение и резервные копии

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 04 |
| Slug | local-storage |
| Title | Локальное сохранение и резервные копии |
| Status | shipped locally — Full Gate PASS, feature merged into main |
| Branch | feature/04-local-storage |

## Goal

Открыть доску после перезагрузки и продолжить с теми же записями и видом.
Автосохранение с честным статусом, JSON-копия/импорт и защита от перезаписи другой вкладкой.
Пользователь принял03 и разрешил двигаться дальше по ранее согласованному M3.

## Design References

Принятый белый компактный экран. Добавить небольшой storage/status/backup блок,
не повторять выбор направления и не менять письмо/инструменты.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Ввести versioned document codec, defaults/clone, строгую валидацию и лимиты, raw/numeric/legacy профиль без потери геометрии; JSON export/import round-trip — _Depends on:_ —
- [x] F2 Реализовать native IDB repository с complete/abort/error/blocked/versionchange, atomic main+before-import и доступом к предыдущей копии; не reset/delete неизвестные данные — _Depends on:_ F1
- [x] F3 Реализовать writer lease и lifecycle/revision/save controller: initial-load gate, immutable capture при flush, serialized queue, debounce/maxwait, ошибки/retry, безопасный cleanup до release и secondary read-only/retry reload — _Depends on:_ F1, F2
- [x] F4 Гидратировать App/Surface через generation и initialDocument, snapshot completed+viewport, семантические change notifications вне per-point path; guards записи/импорта, baseline undo floor, reseed IDs — _Depends on:_ F3
- [x] F5 Добавить компактный статус, export/import+preview/confirm, previous backup download, retry/recovery/read-only; atomically persist before apply, ошибки не теряют память/текущую доску — _Depends on:_ F4
- [x] F6 Проверить visibility/beforeunload и StrictMode/HMR disposal, исключить pending stale writes и ложное «сохранено»; сохранить доступность/Space/navigation/контраст/narrow layout — _Depends on:_ F5
- [x] F7 По чтению готового core: исключить повторную публикацию одинакового StorageState при каждом changed/paused-error, чтобы навигация не вызывала React-render на каждое движение — _Depends on:_ F3
- [x] F8 По независимому ревью: явно отклонять sparse arrays в raw IndexedDB (strokes/points), которые Array.map пропускает; corrupt record должен дать load error без hydrate/write, а не упасть в рендере — _Depends on:_ F1, F3
- [x] F9 По браузерной проверке: не показывать «Повторить подключение» для здоровой writable/saved сессии; лишний reconnect сбрасывает сессионную историю без причины. Оставить reconnect только для read-only/load-error/revoked без unsaved — _Depends on:_ F3, F5
- [x] F10 По проверке предела ID: валидный импорт с MAX_STROKE_ID должен допускать последующие сохраняемые штрихи; выделять свободный допустимый ID без перенумерации загруженных штрихов и без изменения алгоритма письма — _Depends on:_ F1, F4
- [x] F11 Уточнить границу backup при corrupt raw: валидная доска и JSON-представимое сырое значение скачиваются; non-JSON raw сохраняется в IDB без изменений с явным сообщением, без фиктивной пустой копии или обещания автоматического восстановления чужих типов — _Depends on:_ F2, F5
- [x] F12 По ревью file-reader race: oversized-file early return должен сбрасывать reading при замене ещё читающегося файла; старое завершение не меняет новый preview — _Depends on:_ F5

### Infra

- [x] I1 Обновить README/STACK: origin/profile, локальность, копии, лимиты, версия, реальные команды и тестовые границы — _Depends on:_ F6

### Data

None — новая БД создаётся при первом открытии; старой persistent schema нет.

### Other

- [x] T1 Unit/regression codec/controller/history: invalid fields/limits/prototype keys, late load/ack/cleanup, save failure/retry, import success/failure/cancel, undo baseline, принятая геометрия — _Depends on:_ F1, F2, F3, F4, F5, F6
- [x] T2 Реальный браузерный IDB: reload, настройки/вид, round-trip файла, bad/cancel import, atomic backup, ошибки/abort/blocked, two-tab lease/retry; desktop/narrow/console — _Depends on:_ T1, I1
- [x] T3 Пользователь проверяет перезагрузку и резервную копию своей доски; ранее принятые аппаратное письмо/фон не запрашивать повторно без регрессии — _Depends on:_ T2

## Files

### Create / modify

```text
src/document/types.ts
src/document/codec.ts
src/document/indexeddb.ts
src/document/writer-lock.ts
src/document/session.ts
src/document/stroke-ids.ts
src/document/*.test.ts
src/components/StoragePanel.tsx
src/App.tsx
src/components/PenToolbar.tsx
src/components/WritingSurface.tsx
src/drawing/types.ts
src/drawing/history.ts
src/drawing/history.test.ts
src/drawing/input.ts (only optional document-safe ID allocation)
src/drawing/input.test.ts
src/styles.css
docs/SPEC.md
docs/STACK.md
README.md
docs/changes/04-local-storage.md
.artifacts/change-04/ (ignored)
```

### Do NOT touch

- Archived changes/workflow wrappers/playbooks, Git main outside ship, dependencies unless agreed.
- Accepted geometry/stabilization/point-collection/renderer/viewport algorithms, eraser/selection/multi-board.
- Backend/auth/cloud/hosting/PWA/PNG/PDF.
- User's actual saved DB or notes during automated tests. Use task-owned origin
  `http://127.0.0.1:5173`, separate from user's `http://localhost:5173`; never clear whole profile.

## Contracts

See SPEC §3.2, §5.6 and Files above. State/transaction/lease boundaries are required safety contracts.

## Gate Checks

[STACK.md](../../STACK.md) Fast Gate per work, Full Gate only at ship.
Use injected adapters for queue failures but real browser IndexedDB for transaction/lease/reload.
Fake storage passing is not browser durability proof. Browser assertions must wait for actual
saved status/transaction, not a guessed delay. Forced shutdown loss window remains explicit.

## Architect Review Notes

- [x] No architect review issues recorded

## Verification Evidence

- Fast Gate PASS: lint/typecheck; integrated unit suite197 tests in14files, including147
  focused/regression tests in10files. TypeScript LSP:36files,0errors,0warnings;
  one informational deprecation for legacy `beforeunload.returnValue` fallback.
- Independent core/integration review and targeted follow-up: no remaining findings.
  Astra consultation resolved the Node24 native Web Locks test fixture and confirmed
  boundary-ID allocation and the narrowed JSON-compatible raw backup contract.
- Real Windows Chrome through Playwriter:75 distinct latest assertions PASS (78 attempts).
  Evidence `.artifacts/change-04/browser-checks.json`: native IndexedDB reload/exact geometry,
  settings/view, editable export/import, preview/cancel/keyboard guard, atomic main+previous,
  real transaction abort after successful requests, unsaved-memory export/retry, beforeunload,
  two real tabs/lease ownership/latest-state takeover, held import completion, file-reader race,
  boundary IDs, corrupt raw recovery, blocked open/late upgrade, missing Locks and versionchange.
- One initial held-import pixel assertion failed because clearing a notice changed canvas
  dimensions before RAF. The comparison was rebased after modal/layout settlement; unchanged
  product source then passed. The failed attempt and measured dimensions remain in
  `browser-checks.json` and `inflight-harness.json`; this was a harness condition, not a
  hidden passing run or a product fix.
- Browser console/error logs clean. Desktop1440×900 and narrow390×844 screenshots inspected;
  narrow scrollWidth390, writing area465px. Modal preview fits at390px with enabled confirmation
  and cancellation in viewport. Chrome DevTools isolated context was used for visual review
  after Playwriter screenshot timeouts; functional storage acceptance used Playwriter.
  Screenshots/receipts live in ignored `.artifacts/change-04/`.
- Task-only `127.0.0.1:5173` database and Playwriter tab/session were removed after verification.
  User localhost tabs/database and Miro tab were preserved. Vite remains running on5173.
- Captured Blob/download payload and input-file round-trip do not independently prove a file
  landed in the user's Downloads folder. User acceptance subsequently closed T3:
  «Всё ок, делай ship» after the requested reload and actual download/import check.
  Forced browser/system shutdown can still lose an unfinished stroke or uncommitted changes.
  Work did not run Full Gate04 or commit/merge; the ship result is recorded separately below.

## Implementation Notes

- Earlier change03 was accepted by the user, Full Gate passed and it shipped locally to main
  (`06e3098` feature, `64bb29f` archive) before this branch. No remote operation.
- Save on transaction completion, revision queue and exclusive Web Lock protect write ownership.
  Import preserves current completed memory (including unsaved work) in the single previous
  slot before applying a new document. Non-JSON raw records stay intact in IDB with an honest
  download refusal rather than a lossy file.
- Loaded notes form the undo baseline; only actions from this editing session are undoable.
  Accepted stroke geometry/filtering/rendering is unchanged; optional ID allocation supports
  valid imported boundary IDs without renumbering existing strokes. No new dependencies.

## Commit Message

```text
feat(change-04): persist board and add editable backups
```

## Full Gate — ship 04

2026-11-12. User acceptance: «Всё ок, делай ship». All Backlog items and Architect
Review Notes are checked. No application code was changed during ship.

| Check | Result | Evidence |
|-------|--------|----------|
| Infrastructure / bootstrap | PASS | `npm ci` in isolated clean copy,47packages installed |
| Migrations | SKIPPED — no CLI command | Native IDB0→1 schema/load covered by unchanged browser smoke |
| Backend test suite | SKIPPED — no backend | n/a in STACK |
| Frontend build / type-check | PASS | `npm run build`,35modules; TypeScript no emit before Vite |
| Frontend unit tests | PASS | `npm run test:unit`,197tests in14files |
| E2E lint / determinism | SKIPPED — no command | No automated E2E runner |
| E2E suite | SKIPPED — no command | Interactive browser evidence is Smoke |
| Smoke | PASS | Running Vite HTTP200; all41source/config hashes match verified receipt,75distinct latest Playwriter assertions PASS; user T3 accepted |
| SAST | PASS | `npm run lint` — correctness analysis, no dedicated security audit |
| Secrets scan | PASS | `npm run scan:secrets`, no leaks, original checkout including untracked source |
| Dependency audit | PASS | `npm run audit:deps`,0vulnerabilities |
| Accessibility audit | SKIPPED — no formal command | Manual labels/focus/keyboard/responsive checks passed with Smoke |
| Performance budget | SKIPPED — no numeric target | Physical writing accepted earlier; no latency benchmark claim |
| Architect Review Notes | PASS | 0unresolved |

Overall **PASS**. Build artifacts: CSS7.96kB, JS266.49kB (gzip83.51kB).
Clean gate copy was removed; logs, source hashes, browser evidence and built output are retained
under ignored `.artifacts/change-04/` (`ship-gate.json`, `verification.json`, `shipped-dist/`).
The running server and user's notes were preserved. This is local ship; `--release` was not
requested, so no push or deployment verification was performed.

Local merge: `feature/04-local-storage` → `main` by fast-forward at `64d9a74`.
Change archived after the merge; feature branch retained.
