# Change45 — Board theme evidence

Measured2026-11-17 against baseline `a7644d1`. Fixtures and artifacts contain task-owned synthetic
notes only. No personal board was replaced or cleared. The rejected Change41 raster architecture
was not reopened; this change resolves display colors in the existing native renderer.

## Exact raster and data

- Native Windows Chrome: all672 ordinary and192 pressure/highlighter reference comparisons pass.
- Eight full-raster SHA-256 controls (legacy/pen/pressure/highlighter atDPR1/2, all ten colors)
  exactly match the baseline source. All18 version1 mathematical raster hashes also match.
- After twelve theme switches, a10000-stroke/500000-point scene returns to its exact light hash.
  Scene/stroke/point-array identities and canonical ink remain intact.
- Isolated Chromium browser tests cover all ten colors across three instruments, version1/2
  templates/fills/labels and an embedded PNG. Images and alpha stay unchanged; theme switches
  preserve the exact stored document. Light→dark→light returns identical Canvas data.
- Selection PNG bytes and both editable-fragment content and clipboard-PNG hashes remain equal
  across themes. Downloaded JSON equals the saved document.

## Native CPU measurements

Ordinary Windows Chrome was driven by one owned Playwriter session. RAF cadence became throttled
in the background (an observed interval exceeded1000ms), so the existing task scheduler was used
and recorded. These are native input/render CPU measurements, not browser frame/pen latency.
No build, unit test or E2E workload ran concurrently with measured input pairs.

First three warmed alternating baseline/candidate pairs,10000 raw points in50-point batches:

| Pair | Baseline work p95 | Candidate work p95 |
|------|-------------------|--------------------|
| 1 | 0.7ms | 0.7ms |
| 2 | 0.7ms | 0.7ms |
| 3 | 0.7ms | 0.7ms |

Each run retained all10000 points in one commit and reported zero attributable Long Tasks.
The additional dark-theme control had work p950.6ms, one commit and10000 points.

Twelve light/dark switches on10000 strokes with50 points each took median1.3ms / p952.6ms of
native renderer CPU, with zero attributable Long Tasks. Warm geometry caches were retained.
This fixture measures a large distributed board at its ordinary view; it does not establish a
worst-case densely visible scene budget, GPU completion time or physical Wacom/Pencil behavior.

## Interface and acceptance boundaries

Playwriter verified the real Windows Chrome preference, settings, mixed document, minimap and
fresh error/warning logs. Screenshot capture timed out; Chrome DevTools supplied visual inspection
in a separate isolated context. Desktop light/dark and390px coarse/mobile dark layouts preserve
readable controls, visible focus, reachability and no horizontal overflow. Images retain colors.
The Retry save hover regression checks computed contrast≥4.5:1 in both themes under a real
document-worker save failure. All17 focused theme/localization browser scenarios passed.

The bounded Impeccable detector emitted nine advisories for incumbent radii/type sizes and the
functional board-pattern chooser, with no required redesign. Existing visual geometry was kept.
TypeScript LSP did not return for either directory or single-file diagnostics; no LSP-clean claim
is made. The independent review's hover issue was fixed and its narrow re-review passed.

## Reproduction and artifacts

- `npm run bench:build` builds the separate native benchmark; `npm run bench:serve` serves4180.
- `PENABLE_BENCH_SOURCE` and `PENABLE_BENCH_OUT` select the captured baseline and candidate outputs.
- `penBench.themes.lightRaster()` hashes the all-color controls; `penBench.themes.repaint()` measures
  bounded theme redraws; `penBench.ink(10000,50,65,null,"dark")` measures dark ordinary input.
- The preserved baseline source is `.artifacts/change-45/baseline/src`; receipts and provenance
  live under `.artifacts/change-45/` and `.artifacts/performance/change45-{baseline,candidate}/`.
- Native baseline source hash: `cc1095aadc81b57846f4fef3f5aad77ed7b491cdcd87879b2ea7076c0cc1f0d3`.
- Native candidate source hash: `a6dfdcc0f923603da604fc930fb3c9ffc9103c0ab02ea759e251544884f4df7a`.

The later hover fix changes CSS only; the measured native TypeScript renderer remains the same.
Local ship and public Pages publication are separate actions.

## Final Full Gate

The final Pages artifact passed899 unit tests and all156 Chromium/WebKit browser scenarios
(6.9minutes). Bootstrap, both builds, lint/architecture/self-tests, formatting, documentation
integrity, Gitleaks and dependency audit passed; the audit reported zero vulnerabilities.
Development smoke on owned47452 completed native mouse ink and reached Saved locally with a
clean fresh console. The LSP and physical-device limitations above remain explicit.
