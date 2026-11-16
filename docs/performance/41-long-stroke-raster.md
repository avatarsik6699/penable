# Change41: rejected retained-raster feasibility

The proposed dirty-region replay **did not pass** its mandatory feasibility gate. It is not
enabled in production, and change42 does not contain the experimental renderer. Published
b9898ea remains the renderer baseline. Long overlapping strokes remain a measured limitation.

## Experiment and controls

The experiment retained active-layer pixels outside conservative changed device-pixel regions.
It replayed the existing complete vector Path2D once inside a union clip, without changing raw
points, geometry, pressure, opacity or completed rendering. The initial regions used64px tiles
and a2px halo. Incremental pressure-section cursors avoided re-dirtying the staging buffer.
No additional bitmap was allocated.

Native Windows Chrome comparisons failed immediately after activation at8193 samples. A control
painted the **same Path2D**, with identical state, into fresh canvases using a full clip and a
narrow clip. That control reproduced the differences:

| Instrument | Differing RGBA channels | Maximum alpha difference |
|------------|------------------------|--------------------------|
| Pen | 1669 | 141 |
| Pressure | 151 | 12 |
| Highlighter | 187 | 19 |

At device pixel(178,159), inside dirty rectangle(128,64,64,128), pen alpha changed from255 in
the full replay to114 in the narrow replay. Therefore this failure cannot be attributed solely
to insufficient geometric bounds, retained history or a stale path cache. A full-canvas clip
passed; narrow-clip `copy` compositing and a single enclosing dirty rectangle did not fix it.
The evidence establishes clip-dependent native raster output in this environment; it does not
establish a particular Chromium/Skia defect or prove identical behavior on every backend.

One bounded diagnostic added1px sentinel rectangles at opposite canvas corners, expanding the
clip's conservative bounding box to the full canvas. Both sentinels were cleared and replayed.
This removed the large same-path difference, but retained pixels outside the geometric dirty
region still differed as the full path grew: pen alpha193 versus194 at(31,64), and pressure200
versus197 at(399,122). The exact-output requirement was not relaxed.

## Native timing

The sentinel diagnostic also failed the100k ordinary-pen target:

| Measurement | Result |
|-------------|--------|
| Raw points / committed strokes | 100000 / 1 |
| Frame p95 / maximum | 117.2ms / 140.7ms |
| Required frame p95 | <=33ms |
| JavaScript input/render-call p95 | 3.1ms |
| Pointerup submission / two settled RAF completion | 12.9ms / 148.2ms |
| Long Tasks overlapping the measured operation | 284 |

JavaScript call duration alone missed the deferred native raster cost. Measurements included
pointerup and two settled animation frames. The diagnostic was stopped after this failure;
there are no three accepted warmed performance pairs and no claim of a repeatable speedup.
The single contemporaneous baseline had frame p95155.5ms, but environment variance makes that
insufficient evidence of improvement.

## Evidence and disposition

Ignored local receipts are under `.artifacts/change-41/`: `parity-same-path-control.json`,
`parity-copy-fullclip.json`, `parity-sentinel.json`, `long-pen-1-baseline.json` and
`long-sentinel-diagnostic.json`. They include fixture parameters, comparison coordinates and
complete timings. The experimental source is preserved in local stash
`a33b1f7508cfb5192fb1a791f9fdbb552d94dfc9`, with an additional ignored source/patch copy.
These artifacts are local evidence, not portable production assets.

Future renderer work requires another architecture decision. Further arbitrary padding,
sentinel placement, sampling or raster tolerance changes are not authorized by this experiment.
The independent [document-transfer change](../changes/archive/42-bounded-document-transfer.md) may
proceed without this prototype. Physical Wacom latency and GPU retained memory remain separate
acceptance questions.

## Next architecture feasibility

The owner selected another architecture while preserving quality. The next bounded candidate is
full replay through fresh native2D contexts with an alternate readback-optimization request,
using the same painters and complete paths. This is a feasibility proposal, not a measured speed
claim or a production switch. Readback settings do not guarantee a particular backend. Compare
exact pixels first; only passing candidates proceed to fresh timing canvases without readback,
first3 warmed alternating pairs and the unchanged33ms target. Keep this separate from change42.

Independent chunk compositing is not an established replacement for whole-path coverage: two
half-covered primitives can have different union coverage despite identical separate alpha
values. Moving full replay into a Worker alone also cannot establish timely visible ink. A fast
main-thread RAF with stale output is insufficient. A broad custom raster rewrite requires its own
successful precision/performance prototype rather than an assumed benefit.
