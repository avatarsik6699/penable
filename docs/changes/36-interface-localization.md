# CHANGE 36 — English and Russian interface

## Change Metadata

| Field | Value |
|---|---|
| Change | `36` |
| Slug | `interface-localization` |
| Status | `shipped locally` |
| Branch | `feature/36-interface-localization` |

## Goal

Implement the owner-approved ru/en interface contract in SPEC5.27, preserving editing, local notes and offline availability. English static metadata; automatic browser selection and persistent manual language choice through the existing settings gear.

## Backlog

### Frontend

- [x] F1 Add typed bundled EN/RU translation and pure error-message descriptors, app-owned locale preference adapter, metadata/lifecycle and existing-gear language control; preserve editor identity, readonly usability and stored content. — _Depends on:_ —
- [x] F2 Localize all current UI, accessibility, dynamic statuses/errors, diagnostics, default names and worker error display; keep messages locale-neutral until presentation. — _Depends on:_ F1

### Infra

- [x] I1 Install exact i18next/react-i18next, add exact platform capability owner, English shell/manifest and document architecture/tooling contract. — _Depends on:_ —

### Other

- [x] T1 Add locale-specific behavioral E2E fixtures/Page Objects and regressions for language detection/switch/reload/errors/offline/state preservation/readonly/denied preference storage; retain original RU E2E assertions with explicit locale. — _Depends on:_ F1, F2, I1
- [x] T2 Run Fast Gate, LSP, owned Windows Chrome desktop/narrow smoke, focused performance/state checks and independent review; local ship after Full Gate. — _Depends on:_ T1

## Files

### Create / modify

src/** including unit tests (source writer); package.json/package-lock.json; index.html; scripts/pwa/plugin.mjs; scripts/architecture/policy.mjs and focused self-tests if needed; e2e/** and playwright.config.ts; current docs/SPEC.md/FRONTEND.md/STACK.md/PRODUCT.md/DESIGN.md/README.md (parent).

### Do NOT touch

Persisted board format/geometry, user content/names, archived change originals, frozen mock, font licenses, remote branches.

## Contracts

See SPEC5.27 and FRONTEND layer/platform/worker contracts. Source writer owns src only; parent owns package/policies/tests/docs/browser/Git/gates. No backend, OCR, PDF or sync implementation.

## Gate Checks

STACK Fast/Full Gate. Explicit ru-RU ordinary E2E locale; new locale fixtures use isolated contexts and own preferences. Synthetic input is not physical pen acceptance. Both language bundles must work after offline reload.

## Architect Review Notes

- [x] R1 Preserve appearance-save error descriptors at the hook boundary; EN failures must render in English and retranslate after language change (independent review).

- [x] R2 Restore whitespace/interpolation in translated JSX around dynamic values; Full Gate found recommendation button rendered “Применить шаг200” instead of “Применить шаг 200”. Audit other affected JSX boundaries against baseline.

## Implementation Notes

- Context7 quota unavailable; official i18next/react-i18next/React documentation used as fallback.
- Broad directory LSP scan was unresponsive and terminated; key source files and new E2E files returned zero diagnostics, and full tsc passes independently.

## Commit Message

```text
feat(change-36): add automatic and persistent English/Russian UI
```

## Fast verification

PASS: typecheck/build:pages, lint including policy self-tests, format:check, all719 unit tests,
9 locale browser scenarios (8 initial + corrected preference-denial helper), source/new-E2E LSP
key files, archive/link check. Native Windows Chrome via Playwriter: desktop1280×800 and
narrow390×844 EN/RU screenshots, clean error/warning logs, real mouse writing and live switch.
A bounded PerformanceObserver session recorded no>=50ms tasks and retained2 canvases.
Independent review: no unresolved findings; Fallow current snapshot accepted3/rejected0.
Broad LSP directory scan and an initial Playwriter frame-evaluation timeout are not PASS evidence;
the owned tab was closed/reset and page-scoped CDP completed native checks successfully.
No physical Wacom/Pencil or OS installation acceptance is inferred.

## Full Gate

PASS: npm ci; build; build:pages; lint/SAST/architecture and self-tests; format:check;719 unit
tests; all128 Chromium/WebKit browser scenarios on the final Pages artifact; scan:secrets;
audit:deps (zero vulnerabilities); check:docs; independent review/R1/R2 resolved. Typecheck ran
in both builds; individual source/new-E2E LSP checks returned zero. Native EN/RU desktop/narrow
visual/keyboard/log evidence and unchanged input-path performance apply after the text-spacing
repair. Formal automated accessibility audit remains deferred per STACK. Backend, migrations and
container scan are n/a. Physical Wacom/Pencil and OS installation remain unverified. No release.
Final Fallow snapshot graph:534efa72fb61d869 accepted3/rejected0 (anchor validation only).
Logs: /tmp/penable-36-*.log; native screenshots/runtime/review receipts: .artifacts/change-36/.
