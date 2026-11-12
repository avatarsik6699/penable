# CHANGE 07 — GitHub repository and Pages

## Change Metadata

| Field | Value |
|-------|-------|
| Change | 07 |
| Slug | github-pages |
| Title | Public repository and GitHub Pages |
| Status | shipped locally; release pending |
| Branch | feature/07-github-pages |

## Goal

Publish the existing project as public `avatarsik6699/penable` and serve the application
at `https://avatarsik6699.github.io/penable/`. The owner's request explicitly authorizes
repository creation, push and Pages deployment. Preserve the existing application and local notes.

## Design References

Unchanged accepted interface; no visual redesign.

## Backlog

### Backend / Frontend / Data

None — no application behavior or document schema changes.

### Infra

- [x] I1 Review publication contents and Git history for secrets/local data; preserve history and existing ignore rules — _Depends on:_ —
- [x] I2 Add reproducible Pages build/preview for `/penable/`, pinned official Actions workflow, checks on PR/main and main-only deploy with least privilege — _Depends on:_ I1
- [x] I3 Update README, SPEC and STACK for public use, JSON transfer from localhost and concrete release commands — _Depends on:_ I2
- [ ] I4 After green gates, create public GitHub repository/origin, enable Actions-based Pages and publish local main through ship --release — _Depends on:_ I2, I3, T1, T2

### Other

- [x] T1 Run applicable Fast/Full Gates and independent workflow review; record no unresolved findings — _Depends on:_ I2, I3
- [x] T2 Browser smoke of production build at `/penable/`: assets, writing/save/reload/export and clean console/network on owned test origin — _Depends on:_ I2
- [ ] T3 Verify remote main, successful Actions deployment and live HTTPS page/assets/browser; clean only owned test data — _Depends on:_ I4

## Files

### Create / modify

```text
.github/workflows/pages.yml
.node-version
package.json
README.md
docs/SPEC.md
docs/STACK.md
docs/changes/07-github-pages.md
.artifacts/change-07/ (ignored evidence)
```

### Do NOT touch

- Application source, document schema, dependencies/lockfile and accepted UX.
- User localhost/profile notes or browser settings.
- Unrelated GitHub repositories, custom domains, credentials, billing or history rewriting.
- Existing archived changes and workflow playbooks.
- License grants: no new project license is chosen on the owner's behalf.

## Contracts

See SPEC §3–§4 and §6–§8; STACK gate/release commands. Deploy only built `dist`.

## Gate Checks

Full Gate per [STACK.md](../../STACK.md). Additionally scan full Git history before public push.
Keep root local build and Pages build separate; test actual `/penable/` assets. Deployment on PR
is prohibited. Public-site smoke uses a clean owned browser origin before writing synthetic notes;
if prior notes exist, use isolated context. The owner's publication request authorizes release.

### Full Gate — PASS

| Check | Result |
|-------|--------|
| npm ci | PASS |
| Root build + TypeScript | PASS |
| Pages build /penable/ | PASS |
| Unit suite | PASS —252 tests /17 files |
| Production browser smoke + HTTP | PASS —6 checks; HTTP200 |
| Lint | PASS |
| Secrets / dependency audit | PASS —0 leaks /0 vulnerabilities |
| Independent review / architect notes | PASS —0 findings /0 unresolved |
| Backend / migrations / E2E runner | n/a per STACK; nativeIDB browser smoke covered |
| Formal a11y / numeric performance budget | n/a per STACK; accepted UI unchanged |

Receipts: `.artifacts/change-07/ship-gate.json`, `verification.json`, `local-browser.json`.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- Fast Gate: lint/typecheck(Pages build)/252unit tests PASS;6 production browser checks PASS. No TypeScript source changed, so changed-file LSP is n/a. Independent workflow review:0 findings.
- Publication scan:90 tracked files;13 existing commits, no leaks; source/SDD history retained, local artifacts/dependencies/env excluded. No new license granted.
- GitHub connector lacks create-repository/Pages settings operations; authenticated gh CLI is used for release.
- Release verification and public URL confirmation remain pending until push/deploy.

## Commit Message

```text
feat(change-07): publish project with GitHub Pages deployment
```
