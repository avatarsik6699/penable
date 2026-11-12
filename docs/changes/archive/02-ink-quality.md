# CHANGE 02 — Качество письма и масштабирования

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 02 |
| Slug | ink-quality |
| Title | Качество письма и масштабирования |
| Status | shipped locally — Full Gate PASS, feature merged into main |
| Branch | feature/02-ink-quality |

## Goal

Устранить замеченные пользователем размытие и артефакты при письме и увеличении.
Добавить собственный zoom/pan с перерисовкой из геометрии и одинаковый путь рисования
активного/завершённого штриха. Пользователь разрешил обновлять текущие тестовые записи.
Сохранить белый компактный интерфейс; физическое качество письма проверяется отдельно.

## Backlog

### Backend

None.

### Frontend

- [x] F1 Ввести чистую модель viewport/world-screen, anchored zoom и ограничение масштаба; исходные точки штрихов не изменять при навигации — _Depends on:_ —
- [x] F2 Ввести общий детерминированный сглаженный путь для tap/коротких/длинных штрихов, без дублирования позиций, обратных хвостов и различий live/committed — _Depends on:_ —
- [x] F3 Переделать renderer на слои completed/live, один active path на RAF, повторную геометрическую отрисовку при viewport/DPR/visualViewport; ограничить bitmap memory и показать предел качества — _Depends on:_ F1, F2
- [x] F4 Подключить мировые координаты ввода, wheel/ctrl-wheel zoom, Space/middle pan, отмену/cleanup/capture; исключить рисование во время навигации — _Depends on:_ F1, F3
- [x] F5 Добавить компактные zoom controls и короткую подсказку жестов; расширить диагностику масштабом/разрешением; сохранить доступность и responsive layout — _Depends on:_ F4

- [x] F6 Устранить временное превышение bitmap budget при смене портретного/альбомного соотношения: сначала уменьшать размеры слоёв, затем увеличивать; проверить бюджет после каждого назначения width/height — _Depends on:_ F3, T1

- [x] F7 Исправить Space-pan после фокуса на zoom-кнопке или слайдере толщины: жест над доской не должен рисовать штрих; сохранить обычную активацию кнопок пробелом и доступный фокус поверхности — _Depends on:_ F4, F5

- [x] F8 Разобрать новую обратную связь: zoom/blur принят, но письмо менее ровное/читаемое, чем Miro; подобрать минимальную стабилизацию с сохранением исходных точек и контролем задержки/формы букв — _Depends on:_ F2, T2
- [x] F9 Добавить настраиваемый режим стабилизации для сравнения с текущим письмом; режим фиксируется на штрих, live/commit/redraw совпадают, без новых дефектов при zoom — _Depends on:_ F8
- [x] F10 По результату Wacom: стабилизация помогает, но лёгкой мало, усиленной много. Заменить выбор режима слайдером 0–100% (шаг 1%; 0=off, 50=light, 100=strong, старт 65), с непрерывной силой между опорными значениями и совместимостью старых штрихов. Толщина 0.5–12 px с шагом 0.1 px, фиксация обеих настроек при начале штриха, доступная клавиатура/Space-pan и narrow layout — _Depends on:_ F9
- [x] F11 Уточнить по независимому ревью границу совместимости: старые профили сохраняют геометрию в текущей сцене, но смена React hook signature при разработке может перемонтировать App и очистить память вкладки; убрать неподтверждённое заявление о сохранении сцены через Fast Refresh. Обновление тестовых записей разрешено пользователем — _Depends on:_ F10

### Infra

- [x] I1 Обновить README и STACK с реальными controls, архитектурой и проверками change 02 без новых зависимостей — _Depends on:_ F5

### Data

None — сохранение и история вне текущей итерации качества.

### Other

- [x] T1 Добавить unit/regression проверки world/screen и anchor, идентичного пути live/commit, tap/endpoints, clamp и memory budget, игнорирования навигации во время письма и отмены после resize и coalesced fallback — _Depends on:_ F1, F2, F3, F4
- [x] T2 В браузере сравнить штрихи и raster evidence при 100/200/400%, DPR1/2, resize, browser page zoom/native pinch, навигации и отмене; проверить desktop/narrow layout и консоль, записать ограничения — _Depends on:_ F5, T1
- [x] T3 Получить результат пользователя на Wacom One: качество букв/петель/стыков, отсутствие blur после зума и приемлемое ощущение задержки; не заменять синтетическими событиями — _Depends on:_ I1, T2

## Files

### Create / modify

Frontend:

```text
src/App.tsx
src/styles.css
src/components/PenToolbar.tsx
src/components/PointerDiagnostics.tsx
src/components/WritingSurface.tsx
src/drawing/types.ts
src/drawing/coordinates.ts
src/drawing/input.ts
src/drawing/renderer.ts
src/drawing/viewport.ts
src/drawing/geometry.ts
src/drawing/stabilization.ts
src/drawing/*.test.ts
```

Infrastructure/documentation:

```text
README.md
docs/SPEC.md
docs/STACK.md
docs/changes/02-ink-quality.md
.artifacts/change-02/ (ignored browser evidence)
```

### Do NOT touch

- docs/changes/archive/, workflow playbooks/wrappers/plugins.
- Backend, auth, persistent storage, import/export, pressure-dependent width, eraser.
- Several-board management, background grid and undo/redo (next M2 iteration).
- Global browser profiles/driver settings or unrelated user tabs.

## Contracts

See docs/SPEC.md §3–§5, especially §5.4, and the Files list above.

## Gate Checks

Fast/Full/Release Gate: [STACK.md](../../STACK.md). Work ran Fast Gate; local ship ran Full Gate.
Quality evidence must distinguish own board zoom, browser page zoom, native pinch and DPR
emulation. The previous silent-DPR emulation limitation is not proof of native monitor behavior.
At supported resolutions, live and committed geometry must agree; ordinary edge antialiasing
is expected. No promise of zero defects at arbitrary resolution or unlimited document sizes.

### Verification evidence — 2026-11-12

- Baseline main 8d97a58: lint/typecheck PASS; 29 tests PASS. Previous immutable build is
  saved in ignored .artifacts/change-02/baseline-dist. Native pinch changed visual scale1→2
  without changing DPR or bitmap (1921×703), reproducing the reported resolution gap.
- Fast Gate: lint and typecheck PASS; 58 tests in 5 files PASS. TypeScript LSP0diagnostics
  on 16 src files; final focus amendments also checked individually. No new dependencies.
- Same deterministic sine fixture (120 move events): old retained-vs-full-redraw differs
  at1071alpha pixels, maximum alpha delta111. New two-layer renderer differs at0pixels
  after pointerup and0pixels after resize/full redraw. Same endpoint is used at release.
- Own zoom100/200/400%, DPR≈1: horizontal stroke has2partially covered edge pixels at
  all scales; ink spans4/7/13pixels respectively, confirming geometry grows without
  widening the edge blur. At DPR≈2, own400% has2partial edge pixels and25ink pixels;
  both layers2880×1621, total9,336,960pixels. These are fixture results, not a universal
  promise about all curves/hardware.
- Browser own-wheel/ctrl-wheel zoom, anchor preservation, noncancelable wheel, reset,
  ignore-zoom-during-ink, cancel/live clear and committed preservation passed.
- Space-pan after zoom-button focus passed with real browser keyboard input: no ink,
  geometry moves and remains after keyup, canvas receives focus. Normal button activation
  by Space still works. Thickness-range focus regression passed separately: Space remains
  native for the slider; a following canvas drag pans without ink. Middle pan and drawing
  with inverse world coordinates after pan/reset also passed.
- Native pinch through page-scoped CDP: DPR stays≈1; visual scale1→2 changes each bitmap
  1000×610→2001×1221. Active stroke is cancelled, completed geometry survives. Extreme
  native scale4 reaches the explicit memory cap:2layers3708×2262, total16,774,992pixels;
  diagnostic warning appears. No claim of unlimited native-pinch clarity.
- Independent review caught portrait/landscape allocation spike and control-focus pan bugs;
  F6/F7 were added and fixed. Setter trace confirms the two-layer total never exceeds
  16,777,216pixels during1024×8192↔8192×1024 swaps; before fix it reached75,497,472.
  Final source review reports no remaining blocking findings.
- Playwriter was primary for interaction, keyboard, raster and pinch checks. During one
  early pinch probe the user was physically writing in that tab, so its precondition
  failed. A separate automation tab was created and the identical probe passed. Preserve
  this failed attempt as harness context; it is not hidden or attributed to a code fix.
- Chrome DevTools isolated context supplied screenshots (Playwriter capture limitation
  already established) and DPR/range-focus checks. Desktop1440×900,400% and narrow390×844
  inspected. Actual viewport heights round by≤1CSSpx under Windows emulation. No horizontal
  document overflow at390px; writing area remains≈669px high. Fresh-page console: no errors
  or warnings. Canvas-readback performance advisory arises only from raster instrumentation.
- Native browser Ctrl+Equal sent by automation did not change browser zoom/DPR; that exact
  UI shortcut and physical trackpad behavior remain manual acceptance. Silent DPR-only
  emulation remains distinct from real monitor transitions. DPR1/2 initialization, own
  wheel/ctrl-wheel and native visualViewport pinch paths are verified separately.
- I1: README/STACK updated with controls, architecture, pixel budget and test boundaries.
  No save, pressure-width, undo/redo, background grid, backend or release was added.
- Local ignored artifacts: baseline.json, baseline-geometry.json, quality-geometry.json,
  interaction-checks.json, browser-checks.json, desktop-100.png, desktop-400.png, mobile.png.
- User result: «теперь действительно текст не блюрится и масштабируется». Zoom/blur
  improvement is accepted. User additionally reports Miro handwriting feels easier and
  more even/readable. That new finding is F8/F9; handwriting readability is not accepted
  merely because sharpness passed. T3 stays open for the remaining lettering/feel criteria;
  do not ask the user to repeat accepted zoom checks without a new regression concern.

### Stabilization follow-up — F8/F9

- User clarified the remaining difference as «буквы более дрожащие и неровные».
  Added off/light/strong, default light. Raw samples remain canonical; each stroke snapshots
  mode and board zoom. Legacy strokes stay off. Exact endpoint replacement avoids an extra
  filtered-to-tip vertex; duplicate XY never advance the filter, including pressure-only up.
- Authorized Miro comparison used ordinary Pen and one native-mouse zigzag in a blank area.
  Small regular ripples remain in that fixture; no claim about Miro's internal algorithm.
  Exactly one test stroke was undone; the test-region screenshot matches its original pixels.
- Fast Gate: lint/typecheck PASS; 49 focused tests PASS, integrated suite 79 tests/6 files PASS;
  TypeScript LSP 0 diagnostics on 18 source/test TS/TSX files. No dependencies added.
  Independent production review found no actionable issues.
- Controlled 120 Hz fixture, dx=0.5 CSS px, alternating y=±1: interior Y RMS after warmup
  1.000 off / 0.289 light / 0.179 strong; maximum support-point displacement 1.237/1.592 px.
  This verifies numerical jitter attenuation, not physical end-to-end latency or letter quality.
- Browser raster comparisons passed all three modes: 0 changed alpha pixels on stationary
  pressure-only pointerup, setting changes during the stroke, zoom/reset and resize/full redraw.
  Off/light compare the whole bitmap; strong compares the full fixture region. One combined
  CLI call exceeded its 45 s harness budget after off/light passed; strong passed separately
  with no source fix. Receipt preserves the separate runs.
- Select defaults to light; native ArrowDown/ArrowUp switch strong/light. Visible label,
  helper, keyboard focus and desktop 1440×900 / narrow 390×844 screenshots inspected.
  At 390 px document width stays 390, writing area is about 621 px high. Fresh console clean.
- Artifacts: stabilization-browser.json, stabilization-{off,light,strong}.png,
  stabilization-desktop.png, stabilization-mobile.png, stabilization-verification.json,
  miro-comparison.json and miro-{before,jitter,clean}.png (all local/ignored).
- T3 remains open only for the remaining physical lettering/response comparison. Accepted
  zoom sharpness is retained; no ship, merge or release was requested for this follow-up.

### Fine adjustment follow-up — F10

- User tested Wacom and confirmed stabilization helps; light feels insufficient, strong
  excessive. Requested a slider for intermediate strength and finer thickness adjustment.
  This accepts the benefit of stabilization, not the final parameter choice. T3 remains open
  for the adjustable version; already accepted zoom and device checks need no repetition.
- Plan: strength 0–100 step 1, default 65; exact old anchors at 0/50/100. Preserve existing
  profile geometry and raw samples; snapshot numeric strength/zoom and fractional thickness.
  Thickness 0.5–12 step 0.1. Parent owns docs/browser, source implementer owns src/**.
- Verification targets: legacy golden geometry, genuine continuous intermediate strength,
  fractional-width snapshot, live/up/redraw equality at an intermediate value, native keyboard
  steps and Space-pan from either slider, desktop/narrow screenshots and console, Fast Gate.
- Fast Gate PASS: lint/typecheck, 68 focused tests/3 files, integrated 98 tests/6 files;
  LSP 0 diagnostics on 18 TS/TSX files. No dependency or build configuration changes.
- Browser: pre-change 160-point golden fixture matches old profiles and numeric 0/50/100
  exactly (maximum XY delta 0). At capture strength67/width2.4, changing both controls to
  81/4.7 mid-stroke, pressure-only release, zoom/reset and resize each change 0 alpha pixels.
  Native ArrowRight changes width3→3.1 and strength65→66. Space+drag from either focused
  slider pans with no ink and transfers focus to the surface. All through Playwriter.
- UI screenshots: desktop1440×900 and narrow390×844 inspected; no horizontal document
  overflow at390, writing area≈621px. Sliders are≈40px high, labels/readouts visible.
  Playwriter screenshot timed out after fonts loaded; isolated Chrome DevTools supplied
  screenshots and clean console. Local artifacts f10-browser.json, f10-legacy-golden.json,
  f10-desktop.png, f10-mobile.png, f10-verification.json retain the evidence.
- Independent review found no numeric/control defect. It caught the unsupported claim that
  normalizing retained state prevents a Fast Refresh remount. F11 removes that claim from
  source/test wording: legacy profile compatibility is verified; old→new HMR scene survival
  is not promised. User authorized refreshing these test notes. Final edits are wording only.
- Playwriter logs contain Canvas readback performance advisories from pixel instrumentation;
  the fresh isolated UI has no such warnings. No product runtime error observed.

## Architect Review Notes

Final user acceptance: «Отлично, теперь это то, что нужно» after trying the adjustable
strength/thickness version on Wacom. Together with earlier explicit zoom/blur acceptance,
this closes T3. This records the user's writing experience; it does not extend the automated
coverage of native browser shortcuts or claim measured physical latency. All backlog items
are complete. The Full Gate and local ship are recorded below.

- [x] No architect review issues recorded

## Full Gate — ship 02

Run from a clean source copy in `/tmp/penable-ship02-hJeBre`; source hashes match the
browser-verified worktree and f10-verification receipt. Existing dev server remains running.

| Check | Result |
|-------|--------|
| Bootstrap `npm ci` | PASS, clean dependencies installed |
| Migrations | n/a, no persistent storage |
| Backend suite | n/a, no backend |
| Frontend build/typecheck | PASS, 26 modules; JS 240.24 kB / 75.58 kB gzip |
| Frontend unit suite | PASS, 98 tests in 6 files |
| E2E lint/determinism | n/a, no runner configured |
| E2E suite | n/a, interactive smoke required instead |
| Smoke | PASS, unchanged-source Playwriter/DevTools evidence and user acceptance reused; dev server HTTP 200 |
| SAST `npm run lint` | PASS |
| Secrets `npm run scan:secrets` | PASS, no leaks |
| Dependencies `npm run audit:deps` | PASS, 0 vulnerabilities |
| Formal accessibility audit | n/a, no command; manual labels/keyboard/focus/narrow inspection passed |
| Performance budget | n/a, no numeric target; actual writing accepted by user |
| Architect Review Notes | PASS, 0 unresolved |

Overall PASS. Local ship only; no release, push or deployment.
Feature commit `f0daf93` merged fast-forward into local main; this file is archived by ship.

## Implementation Notes

- Initial midpoint curves alone left user-reported jitter. F8/F9 add optional derived
  stabilization while retaining raw samples. Speed-adaptive filtering is inspired by
  [1€ Filter](https://gery.casiez.net/1euro/); the isotropic cutoff, deviation cap and exact
  endpoint policy are local choices. Parameters require physical handwriting acceptance.
- Pixel budget bounds raw two-layer bitmap area, not total browser/GPU memory. Above the
  budget, diagnostics report reduced resolution; own board zoom does not increase allocation.
- User approved refreshing test notes. A user-adopted browser tab is preserved; automated
  follow-up checks use a separate tab/context.


## Commit Message

```text
feat(change-02): improve ink rendering and board zoom
```
