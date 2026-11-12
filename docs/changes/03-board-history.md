# CHANGE 03 — История штрихов и фон доски

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 03 |
| Slug | board-history |
| Title | История штрихов и фон доски |
| Status | implementation and user acceptance complete — ready for ship |
| Branch | feature/03-board-history |

## Goal

Добавить отмену/повтор завершённых штрихов и переключаемый фон для удобных конспектов.
Сохранить принятые качество письма, стабилизацию, толщину и навигацию change 02.
Источник brief: согласованный следующий этап и «Продолжай» пользователя.

## Design References

Принятый белый компактный экран penable, SPEC §5.3. Новых экранов или визуального направления нет.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Ввести единственного владельца commit/undo/redo завершённых штрихов, сохранять объекты/профили и очищать redo только при новом commit; добавить инвалидацию renderer без stale queued commits — _Depends on:_ —
- [x] F2 Подключить кнопки и Ctrl/Meta+Z / Shift+Z, физический KeyZ, guards текста/composition/busy, немедленное состояние доступности и отсутствие лишних подписок/React updates на движении — _Depends on:_ F1
- [x] F3 Ввести чистую модель world-anchored фона с шагом/phase, отрицательным pan и адаптивной плотностью; CSS blank/dots/grid без третьего canvas — _Depends on:_ —
- [x] F4 Добавить компактный выбор фона и синхронизировать его с viewport, сохранив историю, ink, качество и доступность/narrow layout — _Depends on:_ F2, F3

### Infra

- [x] I1 Обновить README/STACK с управлением, архитектурой и проверками без новых зависимостей — _Depends on:_ F4

### Data

None — persistence в M3, не в этом change.

### Other

- [x] T1 Проверить порядок/identity undo/redo, cancel/new commit, commit→undo до RAF, busy/keyboard guards, фон/phase/zoom, отсутствие изменения принятых stroke geometry и bitmap budget — _Depends on:_ F1, F2, F3, F4
- [x] T2 В браузере проверить клавиатуру/кнопки, redo после навигации/настроек/фона/cancel, busy, CSS world anchor и размер canvas; desktop/narrow screenshots и консоль — _Depends on:_ T1, I1
- [x] T3 Получить пользовательскую оценку undo/redo и фона на своей доске; ранее принятое письмо не запрашивать повторно без новой регрессии — _Depends on:_ T2

## Files

### Create / modify

Frontend:

```text
src/drawing/history.ts
src/drawing/history.test.ts
src/drawing/background.ts
src/drawing/background.test.ts
src/drawing/shortcuts.ts (if needed for pure keyboard guards)
src/drawing/shortcuts.test.ts (if needed)
src/drawing/types.ts
src/drawing/input.ts
src/drawing/input.test.ts
src/drawing/renderer.ts
src/drawing/renderer.test.ts
src/components/WritingSurface.tsx
src/components/PenToolbar.tsx
src/App.tsx
src/styles.css
```

Documentation:

```text
docs/SPEC.md
docs/STACK.md
docs/changes/03-board-history.md
README.md
.artifacts/change-03/ (ignored local evidence)
```

### Do NOT touch

- Archived changes, workflow playbooks/wrappers/plugins, Git main outside ship.
- Accepted geometry/stabilization algorithm, pressure width, eraser, selection, multi-board.
- Persistence, imports/exports, backend, auth, hosting or dependencies.
- Browser profiles and unrelated/user-owned tabs.

## Contracts

See SPEC §3.2, §5.3–§5.5 and Files above. Existing renderer memory budget remains binding.

## Gate Checks

Fast/Full/Release Gate: [STACK.md](../STACK.md). This work runs Fast Gate; ship is separate.
Use Playwriter first; reuse unchanged accepted ink evidence and distinguish physical acceptance
from synthetic input checks. Explicitly exercise commit→undo before RAF and text-field native undo.

## Architect Review Notes

- [x] No architect review issues recorded

User acceptance: «Проверил, кажется всё окей, можно двигаться дальше». This closes T3 for
history/background. Prior writing acceptance remains unchanged. Local ship is authorized
as the completion of this stage before continuing to storage/backup.

## Verification Evidence

- Baseline: accepted change02 shipped locally to main via feature commit f0daf93 and archive
  commit3967a9b. Change03 remains on feature/03-board-history; no ship/release requested yet.
- Fast Gate PASS: lint/typecheck, 105 focused/regression tests in7files; integrated suite
  130tests in9files PASS. LSP0diagnostics on24TS/TSX files. No dependencies or build config changed.
- Independent read-only review found no actionable issues. Accepted geometry/stabilization/
  coordinates/viewport modules have no diff from main. Existing two-canvas memory budget holds.
- Playwriter: 29 latest behavioral checks PASS (33attempts retained). Button/nativeCtrl+Z/
  Ctrl+Shift+Z and synthetic Cyrillic KeyZ verified. Undo removes only the last stroke; redo
  restores exact alpha pixels, including original width/profile after later settings changes.
- Commit→undo within the same browser task leaves no queued ghost; redo restores that stroke.
  Pen/pan busy controls and shortcut guards pass. Cancel preserves redo; tools/background/
  zoom/pan preserve redo; only a new completed stroke clears it. Text-field native undo and
  select shortcut scope pass. NativeSpace activates history buttons; Space+drag after undo
  focus pans without accidentally undoing or drawing.
- CSS blank/dots/grid switches preserve ink and allocation: exactly2canvases of1000×562
  in the fixture. Negativepan(-15,-23) gives24px tile phase(9,1); zoom2 doubles step to48;
  zoom.25 coarsens world lattice with12px screen spacing and unchanged bitmap sizes.
  Reset restores exact ink pixels and dots use half-tile phase at world origin.
- One zoom-center harness assertion initially used Playwright boundingBox height, which
  differed from DOM getBoundingClientRect by≈0.000015px under Windows emulation. Expected Y
  phase was off≈0.000008px. The harness now measures center with the same DOM API as the app;
  original1e-6 tolerance retained and identical scenario passes. No product source fix; failed
  and repeated attempts remain in browser-checks.json.
- During incremental multi-file HMR before runtime freeze, the preexisting automation page
  logged missing onHistoryState once before App's new prop was loaded. Fresh page after
  freeze and subsequent runtime checks have0pageerrors. This is not a promise of scene
  preservation across development reloads. Current test notes may refresh by user authorization.
- Playwriter primary for interactions/pixel evidence. Known screenshot capture timeout is
  handled with isolated ChromeDevTools for desktop1440×900 grid and390×844 dots screenshots.
  Narrow document width390 (no overflow), writing height≈573px; controls/labels/focus inspected.
  Fresh isolated UI console has no errors/warnings. Canvas readback advisories belong to tests.
- Local ignored evidence: browser-checks.json, background-checks.json, runtime-errors.json,
  desktop-grid.png, mobile-dots.png, verification.json. User's own local/Miro tabs preserved.
- T3 remains for user review of the new history/background behavior, without repeating accepted
  physical writing/pressure/zoom tests. No Full Gate, commit or merge for03 in this work pass.

## Implementation Notes

None.

## Full Gate — ship 03

Clean install/build in `/tmp/penable-ship03-3enVPM`; source matches the browser-verified
receipt exactly. Existing dev server kept running; no dependency changes in live workspace.

| Check | Result |
|-------|--------|
| Bootstrap `npm ci` | PASS |
| Migrations | n/a, no storage yet |
| Backend suite | n/a, no backend |
| Frontend build/typecheck | PASS,29modules; JS243.46kB /76.53kB gzip |
| Frontend tests | PASS,130tests/9files |
| E2E determinism/lint | n/a, no runner |
| E2E suite | n/a, interactive smoke instead |
| Smoke | PASS, unchanged-source browser evidence plus user acceptance; HTTP200 |
| SAST/lint | PASS |
| Secrets | PASS,0leaks |
| Dependency audit | PASS,0vulnerabilities |
| Formal accessibility audit | n/a, no command; manual keyboard/labels/focus/narrow checks passed |
| Performance budget | n/a, no numeric target |
| Architect Review Notes | PASS,0unresolved |

Overall PASS. Local ship only; no push, release or deployment.

## Commit Message

```text
feat(change-03): add stroke history and board backgrounds
```
