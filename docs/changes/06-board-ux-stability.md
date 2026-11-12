# CHANGE 06 — Стабилизация доски и UI/UX

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 06 |
| Slug | board-ux-stability |
| Title | Стабилизация доски и UI/UX |
| Status | active |
| Branch | feature/06-board-ux-stability |

## Goal

Непрерывно видимый app-cursor, спокойный keyboard focus, двухосевое перемещение тачпадом
и стабильное полотно при изменении статусов. Пользователь выбрал компактную точку,
wheel pan/Ctrl zoom, полировку текущего UI и компактное «Хранение», затем «Implement the plan».

## Design References

Принятый светлый интерфейс SPEC §5.3; текущие source/CSS и снимки change05.
Точка3px+светлый1px ореол, кольцо8px/рука для режимов, метка «Полотно» только keyboard.
Основные инструменты сохраняют место; storage secondary actions в popover.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Ввести pure cursor controller: CSS position, owner/mode/visibility, pen leave retention, mixed pointer/blur/modal/return и cleanup; meaningful unit tests — _Depends on:_ —
- [x] F2 Интегрировать DOM overlay в Surface с одним RAF, native cursor fallback/hidden, tool/pan shapes, overlay hit gating; без per-sample React и мутации чернил — _Depends on:_ F1
- [x] F3 Расширить wheel API:2axes, units, Ctrl/pinch anchor zoom, Shift,150ms inertia quarantine и synchronous busy; unit/regression проверки — _Depends on:_ —
- [x] F4 Убрать canvas outline, сохранить Tab-focus с меткой, controls focus и корректное отключение zoom при ink/erase/pan — _Depends on:_ F2, F3
- [x] F5 Перенести secondary storage actions/messages/help в accessible nonmodal popover; стабильные bounds, видимая постоянная ошибка, outside/Escape/repeat close, modal import guards — _Depends on:_ F2
- [x] F6 Интегрировать cursor availability с App/modal/focus/resize и wheel с persistence/read-only; сохранить pen/eraser/history/JSON contracts — _Depends on:_ F2, F3, F4, F5

### Infra

- [x] I1 Обновить README/STACK/документацию управления и ограничений — _Depends on:_ F6

### Data

None — nativeIDB1/schemaVersion1 и данные пользователя сохраняются.

### Other

- [x] T1 Fast Gate: affected/regression unit suite, lint/typecheck, changed-file LSP и независимое review — _Depends on:_ F1, F2, F3, F4, F5, F6
- [x] T2 Реальный браузер: cursor contact/leave/return/mixed input/modal, wheel axes/units/Ctrl/Shift/inertia, keyboard/busy, status bounds while ink/erase, read-only/save/reload/JSON, desktop/narrow/screenshots/console — _Depends on:_ T1, I1
- [x] T3 Запросить аппаратную пробу Wacom/тачпада, зафиксировать фактический ответ или UNVERIFIED без фиктивного PASS; не блокировать local ship только ожиданием ответа по правилу владельца — _Depends on:_ T2

## Files

### Create / modify

```text
src/drawing/cursor.ts
src/drawing/cursor.test.ts
src/drawing/viewport.ts
src/drawing/viewport.test.ts
src/drawing/types.ts (only ephemeral presentation/control types if needed)
src/components/WritingSurface.tsx
src/components/PenToolbar.tsx
src/components/StoragePanel.tsx
src/App.tsx
src/styles.css
README.md
docs/SPEC.md
docs/STACK.md
docs/changes/06-board-ux-stability.md
.artifacts/change-06/ (ignored)
```

### Do NOT touch

- Archived changes/workflow wrappers, dependencies/lockfile, Git main outside ship.
- Canonical input/stabilization/geometry/renderer/eraser/hit-test/history algorithms.
- Production document modules/schema/repository/locking; use existing save/recovery APIs.
- User localhost notes/profile/Chrome configuration/Windows Wacom settings.
- Multi-board, backend/cloud/PWA, partial erasing, pressure width, unrelated design replacement.

## Contracts

See SPEC §3–§4, §5.3, §5.6–§5.8 and Files above.

## Gate Checks

[STACK.md](../STACK.md) Fast Gate for work, Full Gate for ship. User authorized automatic local
ship after successful automated checks/review. Hardware acceptance reported independently.
Interactive tests use owned127.0.0.1origin/isolated context, not user's localhost notes.
Probe canvas pixels through an offscreen readback context to avoid test-only Chromium warnings.
Playwriter first; fallback only with documented cause. Reuse unchanged valid evidence.

### Full Gate — PASS (2026-11-12)

| Check | Result |
|-------|--------|
| Bootstrap — npm ci | PASS |
| Frontend build + strict TypeScript | PASS |
| Unit suite | PASS —252tests,17files |
| Smoke | PASS —42 final browser assertions, unchanged source hashes; HTTP200 |
| SAST — repository lint | PASS |
| Secrets — gitleaks | PASS —0leaks |
| Dependency audit | PASS —0vulnerabilities |
| Architect Review Notes | PASS —0unresolved; independent review0 actionable findings |
| Backend / CLI migration / E2E runner | n/a per STACK; real nativeIDB covered by smoke |
| Formal accessibility / numeric performance budget | n/a per STACK; keyboard/focus/responsive checked in smoke |
| Release | Not requested; local delivery only |

Gate receipt: `.artifacts/change-06/ship-gate.json`. Temporary bootstrap/build checkout removed.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Автоматические проверки:252tests/17files, affected26tests; lint/tsc PASS. LSP0errors/0warnings (1 unchanged informational deprecation), design detector0, independent review0 actionable findings.
- Браузер: собственный127.0.0.1origin; cursor/keyboard/wheel/inertia/eraser/popover, realIDB abort/retry/export/reload и read-only peer проверены. Снимки desktop/narrow и DPR2 через isolated Chrome DevTools после ограничений Playwriter capture/emulation. Артефакты: `.artifacts/change-06/verification.json`.
- Аппаратная проба нового курсора Wacom и физических жестов тачпада запрошена; ответ пока не получен, UNVERIFIED. По инструкции владельца это не блокирует автоматический local ship. Существующие записи localhost не затрагивались.

## Commit Message

```text
feat(change-06): stabilize board cursor navigation and UI
```
