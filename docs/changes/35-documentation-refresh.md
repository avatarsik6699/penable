# CHANGE 35 — English documentation and repository housekeeping

## Change Metadata

| Field | Value |
|---|---|
| Change | `35` |
| Slug | `documentation-refresh` |
| Status | `shipped locally` |
| Branch | `feature/35-documentation-refresh` |

## Goal

Implement the owner-approved repository presentation plan, stage one: current English documentation, verified historical ZIP archive, corrected documentation/code drift and conservative local cleanup. Stage two (36) adds ru/en and stage three (37) records English demonstrations and rewrites the showcase README.

## Backlog

### Other

- [x] T1 Translate current public/internal Markdown to English, preserve exact quotes/commands and historical acceptance, reconcile current capability/schema/storage claims against source; retain detailed user guidance. — _Depends on:_ —
- [x] T2 ZIP original changes01–34 unchanged with English index and SHA-256 manifest; fix active archive links and future change numbering. — _Depends on:_ —
- [x] T3 Inventory generated artifacts; remove only unused, unreferenced regenerable builds/copies, preserving evidence, baselines, approved design and licenses. — _Depends on:_ T1, T2
- [x] T4 Verify documentation links/archive integrity, Fast Gate and independent review before local ship. — _Depends on:_ T1, T2, T3

## Files

### Create / modify

Current Markdown documents, docs/changes/archive/{changes-01-34.zip,README.md,index.json}, docs/playbooks/plan.md, scripts/documentation/*, package.json (documentation check only), docs/STACK.md, ignored .artifacts cleanup candidates.

### Do NOT touch

Production src, E2E behavior, persisted user data, original archived change content, frozen design assets, licenses, Git history and remote branches.

## Contracts

Owner-approved plan in chat; docs/SPEC.md current product contracts and docs/FRONTEND.md. Full Gate and automatic local ship remain mandatory. Public deployment is separate. The upcoming ru/en interface and four planned capabilities are approved intent, not implemented functionality.

## Gate Checks

Standard STACK Fast/Full Gate; additionally verify ZIP entry hashes and active Markdown links. Production UI/engine unchanged; existing runtime/performance evidence applies, no new hardware claim.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Removed only the unreferenced change09 candidate build (794,149 bytes); retained historical baselines, source snapshots, screenshots and verification receipts. Cleanup receipt: ignored `.artifacts/change-35/cleanup.json`.

## Commit Message

```text
docs(change-35): refresh English docs and preserve history in ZIP
```

## Full Gate

PASS: npm ci; build; build:pages; lint (including SAST/architecture); format:check;
707 unit tests; 119 Chromium/WebKit E2E regressions; check:docs (59 relative file links,
34 ZIP entries); scan:secrets; audit:deps (zero vulnerabilities); independent review.
Typecheck ran in both builds. Production source and frozen design assets are unchanged;
existing interactive/performance evidence applies. No new hardware/OS acceptance or release claimed.
LSP: n/a, no TypeScript changes. Backend/migrations/container scan: n/a for this static app.
Formal automated accessibility audit: deferred per STACK; no UI changes in this stage.
Build retains the existing large-chunk warning. Logs: /tmp/penable-35-*.log.
