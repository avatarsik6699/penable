# CHANGE 37 — Visual English repository showcase

## Change Metadata

| Field | Value |
|---|---|
| Change | `37` |
| Slug | `readme-showcase` |
| Status | `shipped locally` |
| Branch | `feature/37-readme-showcase` |

## Goal

Finish the approved repository presentation plan: compact English README for handwritten study
notes on Windows, supported workflow comparisons, explicit available/planned checklist, actual
English application demonstrations and separate detailed guide.

## Backlog

### Other

- [x] T1 Move detailed user/developer guidance to docs/GUIDE.md and write concise English README with primary CTA, concrete pen/fragment/math/local benefits, sourced Excalidraw.com and Windows alternatives comparison, current versus planned checklist and simple local-backup Mermaid diagram. — _Depends on:_ —
- [x] T2 Capture three actual English UI GIFs (writing, exact fragment move/undo, math templates/boards) with authored demo data; export static PNG posters, bounded GIFs and reproducible sources/metadata. — _Depends on:_ —
- [x] T3 Check actual frames/playback metadata, captions/links/claims, disclosure of scripted input, static alternatives and documented encode workflow; independent review and Fast Gate. — _Depends on:_ T1, T2

## Files

### Create / modify

README.md and docs/GUIDE.md (documentation writer); docs/media/*, scripts/media/*,
package.json (media encode command), docs/STACK.md, this change and ignored .artifacts/change-37
(parent). Existing app/dependencies/architecture remain unchanged.

### Do NOT touch

Production src, existing E2E, user browser data/profiles, original history, frozen mock/assets,
licenses, remote branches. Demo uses a fresh owned local origin and new synthetic notes only.

## Contracts

Approved chat plan; current SPEC5.27 and FRONTEND. GIFs record actual production app with scripted
mouse input, never claim physical pen latency or unseen capabilities. PDF import/annotation/export,
partial eraser, optional sync and OCR remain unchecked Planned entries without delivery dates.
Use only verified comparison facts; existing offline/local save are shared with Excalidraw.

## Gate Checks

STACK Fast/Full Gate. Validate ZIP/active links; inspect opening/action/final frames and GIF format,
dimensions, durations, frame count and <=3MiB per GIF. Production source unchanged: preserve/reuse
Change36 UI/input/hardware boundaries; standard Full Gate still runs before local ship.

## Architect Review Notes

- [x] R1 Preserve the verified capture application commit in each raw take and reject missing/mixed capture versions during encoding; never infer screenshot provenance from the encoder's current HEAD.

## Implementation Notes

- Production source and E2E are unchanged from Change36; native capture is real Windows Chrome
  with scripted mouse input, not new pen hardware acceptance.
- Raw take metadata preserves the verified capture commit 6fbf9b6; the encoder rejects missing
  or mixed versions instead of attributing old screenshots to its current HEAD.
- Three GIFs are 960×600, 100 frames/10 seconds with uniform 100ms timing, total 528561 bytes.
  Static PNG alternatives and immutable asset hashes are included; original takes remain ignored.
- Independent review and focused re-review closed R1. Fast Gate lint/format/typecheck, 83 local
  file links and 34 archived ZIP hashes passed. Missing/mixed capture provenance was rejected
  in isolated temporary-directory checks, and re-encoding preserved all final media hashes.

## Commit Message

```text
docs(change-37): showcase handwriting workflows with English GIFs
```

## Full Gate

Overall PASS; independent review and R1 re-review have no unresolved findings.

| Check | Result |
|---|---|
| Bootstrap | PASS — npm ci, unchanged lockfile |
| Frontend build / types | PASS — npm run build, strict tsc |
| Pages artifact | PASS — npm run build:pages, strict tsc; existing chunk-size advisory retained |
| Unit suite | PASS — 719 tests / 65 files |
| E2E lint / determinism | PASS — lint, architecture and spacing self-tests, format:check |
| E2E suite | PASS — all 128 Chromium/WebKit scenarios, 4.6 minutes |
| Documentation / archive | PASS — 83 local file links, all 34 ZIP-entry hashes |
| Smoke / accessibility | PASS for scope — real English Windows Chrome writing, lasso move/undo, board/template UI and clean logs; PNG/poster and sampled encoded frames inspected. Change36 desktop/narrow keyboard/EN/RU evidence applies to unchanged app source. Formal automated accessibility audit deferred per STACK. |
| SAST | PASS — repository lint and architecture checks |
| Secrets | PASS — Gitleaks, no leaks |
| Dependencies | PASS — npm audit, zero vulnerabilities |
| Performance | PASS for scope — app/input source unchanged; reuse Change36 bounded native mouse/language-switch receipt (zero >=50ms Long Tasks, two canvases). GIF timing is explanatory. |
| Media | PASS — every GIF/PNG hash verified, 960×600, 100 frames at uniform 100ms, 10 seconds and <=3MiB each; encoding reproduced assets; missing/mixed capture commits rejected |
| Architect Review Notes | PASS — zero unchecked items |
| Backend / migrations / container | n/a — browser-only application |
| Release | Not requested; no push or Pages publication |

Physical Wacom/Pencil latency and OS installation are not newly verified. App source and E2E are
identical to main at capture commit 6fbf9b6; no new TS source needs LSP diagnostics in this change.
Logs: /tmp/penable-37-*.log; original capture evidence: .artifacts/change-37/frames/.
The task-owned browser tab, Playwriter session and local preview were closed; personal tabs/data
were preserved. Re-encoding never deletes original takes.
