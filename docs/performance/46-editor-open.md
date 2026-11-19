# Opening a million-point board in the editor

The production editor mounts a scene with its own item list, item wrappers and camera.
Completed ink points are shared with the loaded snapshot. The generic deep clone remains
available to callers that need independent mutable points.

## Results

The two Pages builds use baseline `6ba59b4`. The candidate adds only the snapshot and
editor-runtime hydration edits from Change 46. The fixture opens a 20,000-stroke board
containing one million offscreen points from a small board via the library. A frame probe
dispatches pen contact to the new canvas and immediately cancels the accepted contact.
Time runs from the board selection click to the first frame accepting input. The longest
gap includes the final interval before acceptance. The fixture commits no extra stroke.

Ordinary Windows Chrome 158, one warmed run per build followed by three alternating pairs.

| Pair | Baseline ready, ms | Candidate ready, ms | Baseline longest timer gap, ms | Candidate longest timer gap, ms |
|---|---:|---:|---:|---:|
| 1 | 2327.9 | 2183.9 | 91.3 | 31.6 |
| 2 | 2245.5 | 2079.3 | 54.4 | 21.1 |
| 3 | 2168.3 | 1926.7 | 47.2 | 22.5 |
| Median | 2245.5 | 2079.3 | 54.4 | 22.5 |

Immediate UI heap samples varied with GC (baseline 146.6–335.0 MiB, candidate
203.5–407.7 MiB). A separate controlled run used a fresh headless Chromium 151
process per sample, requested garbage collection after input readiness, then read
`Performance.getMetrics` in the page target. Baseline retained 119.25–119.30 MiB
across three runs and the candidate retained 65.21–65.44 MiB, a median reduction
of approximately 54 MiB. Worker, GPU and total process memory require separate probes.

## Reproduction

Serve isolated baseline and candidate Pages builds on loopback ports 4266 and 4267.
Use an owned Playwriter tab as `state.page`, set `state.port`, then run
[scripts/performance/editor-open.js](../../scripts/performance/editor-open.js) with a 90-second
command budget. The runner seeds only empty origins and reuses its marked fixture.
Run each build once to warm it before collecting paired samples. In a managed
Chromium fixture with full CDP access, `state.collectHeap=true` requests GC
after acceptance. A project unit regression also checks that the actual editor mount
performs zero indexed point reads for one million points. Physical pen latency and
the cost of rendering a million visible points are separate workloads.
