# CHANGE 01 — Проверка письма пером

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 01 |
| Slug | pen-input |
| Title | Проверка письма пером |
| Status | active — verified; hardware input confirmed; ready for ship |
| Branch | feature/01-pen-input |

## Goal

Дать пользователю локальную страницу для проверки письма своим планшетом: линия во время
движения, настройка толщины, фактические данные ввода. Проверить устройство и качество
обработки событий до разработки доски и хранения. См. [SPEC.md](../SPEC.md), M1.
SPEC утверждена пользователем 2026-11-12. Устройство: Wacom One, Windows 11.

## Backlog

### Backend

None — клиентский прототип без API.

### Frontend

- [x] F1 Светлый экран с компактной панелью, толщиной, полем, предупреждением о временных записях, keyboard focus и переносом панели на узком окне — _Depends on:_ I1
- [x] F2 Модель штрихов и независимый контроллер Pointer Events: один pointerId, pen/mouse, точка при касании, capture и финальный образец; исключить hover, вторую кнопку, touch и второй указатель — _Depends on:_ I1
- [x] F3 Инкрементальный Canvas 2D renderer и интеграция с React; fallback coalesced events, resize/DPR, отмена, потеря capture/фокуса, cleanup и StrictMode без двойного ввода — _Depends on:_ F1, F2
- [x] F4 Компактная диагностика pointerType/pressure, активности, DPR и coalesced capability без React-render на каждую точку; сообщение о недоступном Canvas — _Depends on:_ F3

- [x] F5 Исправить найденное при независимой проверке смешивание coalesced-образцов и aggregate-события; добавить тест на отсутствие обратного сегмента, сохранив конечный pointerup — _Depends on:_ F2, T1

- [x] F6 Обновлять bitmap при отдельной смене DPR без изменения CSS-размера; проверить в браузере после обнаруженного пробела в matchMedia-обработке — _Depends on:_ F3

### Infra

- [x] I1 Минимальный React + TypeScript + Vite проект, lockfile и .gitignore с сохранением SDD-файлов; определить lint/typecheck/test/build scripts, сканирование секретов и актуализировать STACK; не запускать генератор с перезаписью непустой директории — _Depends on:_ —
- [x] I2 README: запуск в WSL, localhost в Windows Chrome, ограничения прототипа и сценарий проверки планшета; не обещать давление без фактического ввода — _Depends on:_ F4

### Data

None — только память вкладки. IndexedDB и резервные копии в следующих change.

### Other

- [x] T1 Проверки инвариантов: второй pointerId не портит штрих; касание и финальная точка сохраняются; отмена/capture не оставляют ввод активным; координаты независимы от DPR — _Depends on:_ F2, F3
- [x] T2 Проверить через Playwriter письмо мышью, искусственный pen отдельно от аппаратного, выход за границы, отмену, resize/DPR, толщину и консоль; записать результаты и пробелы — _Depends on:_ F4, T1
- [x] T3 Подготовить аппаратную пробу и зафиксировать явный результат пользователя: устройство, строки/точки/петли, pressure, жесты; без пользовательского результата оставить пункт открытым — _Depends on:_ I2, T2

- [x] T4 Разобрать результат пользователя: Wacom One пишет, но видимого отклика толщины на нажим нет; уточнить pointerType и изменение численного pressure, отделив постоянную толщину M1 от передачи давления устройством — _Depends on:_ T3

## Files

### Create / modify

Frontend:

```text
index.html
src/main.tsx
src/App.tsx
src/styles.css
src/components/PenToolbar.tsx
src/components/PointerDiagnostics.tsx
src/components/WritingSurface.tsx
src/drawing/types.ts
src/drawing/input.ts
src/drawing/coordinates.ts
src/drawing/renderer.ts
src/drawing/input.test.ts
src/drawing/coordinates.test.ts
src/drawing/renderer.test.ts
```

Infrastructure / documentation:

```text
package.json
package-lock.json
.gitignore
tsconfig*.json
vite.config.ts
.oxlintrc.json
.gitleaks.toml
.artifacts/change-01/ (ignored local browser evidence)
README.md
docs/STACK.md
docs/changes/01-pen-input.md
```

Backend: None.

### Do NOT touch

- docs/playbooks/, .agents/skills/, .claude/skills/, plugins/sdd-workflow/ — workflow bundle.
- docs/changes/archive/ — только ship архивирует работу.
- Другие проекты, глобальные настройки агентов, Chrome-профили и драйвер Wacom.
- Сохранение, undo/redo, навигация, фон, ластик и сервер — вне change.
- docs/SPEC.md — не менять согласованные требования без обсуждения.

## Contracts

See docs/SPEC.md §3–§4, §5.1–§5.3, §7–§8 and the Files list above.

## Gate Checks

Fast / Full / Release Gate определены в [STACK.md](../STACK.md).
Результаты /work и последующего Full Gate приведены ниже. Пользователь принял прототип
и явно запросил локальный ship 2026-11-12: «Всё работает, думаю можно закрывать change, делай ship».
T2 не заменяет T3: искусственный pen подтверждает обработчик, устройство проверяет пользователь.
Отсутствие изменяемого pressure не ломает ручку фиксированной толщины; наблюдение записывается
как ограничение конфигурации. Утверждение о поддержке давления требует реальной пробы.

### Verification evidence — 2026-11-12

- Fast Gate: `npm run lint` PASS (Oxlint, including hooks); `npm run typecheck` PASS;
  `npm run test:unit` PASS — 29 tests in input/coordinates/renderer (3 files).
- TypeScript LSP: 0 diagnostics, 12 src files + vite.config.ts checked. Final F6 src
  diagnostics and build passed after the ResizeObserver change.
- Focused build/config check: `npm run build` PASS — 23 modules, JS 228.65 kB / 71.86 kB gzip.
  This is a build check during setup, not certification of the Full Gate or a release.
- I1 tooling checks: Gitleaks source scan found no leaks; dependency audit found 0 vulnerabilities.
  Fresh `npm ci`, Full Gate, merge, archive, commit and push were not performed by `/work`.
- Browser: ordinary Windows Chrome via Playwriter; native mouse renders before release and
  retains capture when leaving the surface, then stops drawing after release outside.
  Synthetic pen checks passed: final point/tap, cancel, lost capture, blur, hover/right/touch
  rejection, second-pointer isolation. Synthetic pressure 0.370 is displayed; this is not
  evidence of physical Wacom pressure. Keyboard selected width 12 with visible focus.
- Resize: clean-baseline probe confirms active ink is removed, completed ink survives,
  and clipped far geometry returns after shrinking/re-expanding. Earlier probe failures were
  test scene contamination / weak resize synchronization; the isolated rerun passed.
- Screenshots: Chrome DevTools fallback after Playwriter capture timeouts; desktop target
  1440×900 and narrow target 390×844. Actual height rounds by at most one CSS pixel in this
  Windows emulation. No horizontal document scroll at width 390; diagnostics panel fits
  inside the narrow viewport. Application console has no errors. Canvas readback checks
  produce Chrome's expected willReadFrequently advisory, not an application error.
- Canvas-unavailable fallback: deliberately mocked null getContext in a separate test tab;
  explanatory alert rendered without console errors.
- DPR: initialization and logical geometry verified at measured DPR ≈1 and ≈2; a DPR change
  accompanied by real viewport resize preserves completed ink and resizes the bitmap.
  Silent DPR-only CDP emulation dispatches neither media-query change nor window resize nor
  physical-pixel observer callbacks, as confirmed by an independent probe. F6 adds the
  physical-pixel observer and retains fallbacks; real Windows monitor transitions remain
  unverified. No idle polling or test-specific application hook was added.
- Independent source review found no remaining blocking issues after F5/F6. Fallow graph
  review unavailable because this repository has no committed baseline.
- Local ignored evidence: `.artifacts/change-01/{desktop.png,mobile.png,playwriter-checks.json}`.
  The mobile image includes unattributed manual-looking input; it does not establish
  hardware acceptance. Browser automation never asserts that the real pen works.
- User hardware result: «Проверил Wacom One, письмо работает, но нет отклика от силы
  нажима. Письмо и линии такие же, как при написании мышью». Follow-up: «Да в диагностике
  есть различие между pen и mouse, а также силой нажима». Wacom One on Windows 11
  therefore has user-confirmed writing, pen/mouse differentiation and variable raw pressure.
  Fixed rendered thickness is intentional under SPEC §5.2, so T4 is resolved without code change.
  T3/T4 are complete for that confirmed scope. Driver version, quantitative latency,
  sustained-load behavior and native monitor transitions were not verified; do not infer them.
  No repeat confirmation of the already accepted handwriting/pressure result is needed.

### Full Gate — ship 01, 2026-11-12

Result: **PASS**. All 12 Backlog tasks checked; 0 unresolved Architect Review Notes.
A byte-identical isolated copy was used for fresh installation/build/tests so the running
local prototype and transient handwritten notes in open tabs were left untouched.
Source hashes match the previously browser-verified and user-accepted implementation.

| Check | Result | Evidence / applicability |
|-------|--------|--------------------------|
| Infrastructure / bootstrap | PASS | npm ci; 47 packages installed from package-lock.json in isolated copy |
| Migrations | SKIPPED — n/a | No persistent storage in M1 |
| Backend test suite | SKIPPED — n/a | No backend |
| Frontend build / typecheck | PASS | npm run build; TypeScript + Vite, 23 modules; JS 228.65 kB / gzip 71.86 kB |
| Frontend unit tests | PASS | npm run test:unit; 29 tests, 3 files |
| E2E lint / determinism | SKIPPED — n/a | No automated E2E runner configured |
| E2E suite | SKIPPED — n/a | Interactive evidence and hardware acceptance recorded above |
| Smoke | PASS | Existing npm run dev server: HTTP 200 for root and main entry; unchanged source hashes, prior Playwriter/DevTools evidence and explicit user acceptance reused |
| SAST / correctness lint | PASS | npm run lint; Oxlint correctness and hooks checks; not a dedicated security audit |
| Secrets scan | PASS | npm run scan:secrets; Gitleaks scanned ~165 kB, no leaks |
| Dependency audit | PASS | npm run audit:deps; 0 vulnerabilities including development dependencies |
| Accessibility audit | SKIPPED — formal automated audit deferred | Manual labels, focus, keyboard and narrow layout already verified; source unchanged |
| Performance budget | SKIPPED — n/a | No agreed numeric latency target; physical writing accepted by user |
| Architect Review Notes | PASS | 0 unresolved |

Release Gate not requested. No remote/push/deploy. First ship bootstraps local main from
this feature's initial commit because no main commit exists yet; subsequent archive changes
are committed on main without rewriting history or deleting the feature branch.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Device-pixel observation complements CSS-size observation; silent CDP DPR changes are
  not a substitute for a real monitor/zoom event. Keep this acceptance boundary explicit.
- Notes are intentionally transient in M1. No persistence or backup controls were added.


## Commit Message

```text
feat(change-01): add pen input prototype and diagnostics
```
