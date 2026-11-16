# Change42: bounded document processing

Change42 removes whole-document work from the ordinary UI import, replacement, open and recovery
paths. Persisted document5/catalog2/IDB1 formats, raw samples and rendering are unchanged. The
[change41 renderer experiment](41-long-stroke-raster.md) failed its feasibility gate and is not
enabled by this change.

## Mechanisms and invariants

- Numeric transport packs across source boundaries: <=2048 points and64 ranges per packet,
  <=64 metadata items,65536-character asset pieces. Metadata flushes before exceeding2048 mask
  vertices, except a single larger legal mask. Two data packets may remain unacknowledged.
- Acknowledgement follows acceptance. Duplicate/stale ACKs cannot grant credit twice; future
  sequences, cancellation, failed posts and Worker errors reject waiters. Cache knowledge commits
  only after successful completion. Source arrays remain attached and unchanged.
- Generic mutable Reader/Session APIs retain call-time snapshots and strict validation. The owned
  production path accepts only detached storage values; raw chunking preserves malformed values,
  missing properties, holes and strict decoder behavior instead of numeric coercion.
- Import UI holds a private validated candidate capability and frozen summary. Confirmation
  retains image preflight and atomic replacement; failed confirmation can retry the same candidate.
  Close/stale reads/unmount/success dispose it.
- Production storage reads and strict decoding run in a dedicated Worker. The library reads
  catalog metadata first and reuses one prepared board in its Session. It does not read/decode
  the large board again. Initial library bootstrap uses retained raw data inside that Worker.
- Recovery Blob/error copies capture the loaded record snapshot. Later writes, readonly tabs
  and loader termination cannot change their contents. Durable replacement separates asset/source
  namespaces, preserves corrupt raw backup in the same transaction and returns the previous copy
  only after commit. Started transactions drain before Worker termination and lease release.

The raw-copy projection detaches only known six-number wire matrices. This repairs the baseline
identity-matrix singleton alias without changing stored data, unknown properties or descriptors.
An internal canonical-identity map restores cloned containers' original identities during the
existing serializer's seen checks; it cannot split repeated actual objects. Matrix occurrences
are the sole deliberate split. Generic one-argument serialization remains unchanged. Arbitrary
cycles, unsupported descriptors/prototypes and unrelated repeated references remain unsupported.

## Measurement method

Baseline source is published b9898ea. The separate benchmark build runs actual production
factories in ordinary Windows Chrome on an explicitly owned loopback origin, not personal notes.
Fixture:20k independent strokes ×50 points =1M raw samples; JSON50,326,946 bytes. Numeric values
and order are compared using exact canonical hashes outside latency windows. Each measurement
includes two settled animation frames. An8ms timer and Long Task observer measure UI processing;
wall time includes Worker work and scheduling. This is not physical pen latency.

The final sequence is the first3 valid warmed alternating baseline/candidate pairs. It covers
file reading, durable replacement, export, Session open, existing-catalog Library open, readonly
open and switching back to the large board. Heavy checks run separately. Successful large
recovery Blobs must be observed, rather than inferring their cost from early serializer errors.

Environment: Windows Chrome157, DPR1.2145833, viewport1582×669; synthetic data only. Local native
timing is hardware-specific. The runner starts long promises in-page and polls them, retaining
the execution context origin. It does not rely on a long forwarded CDP request.

| Phase | Baseline wall median | New wall median | Baseline worst timer gap | New worst timer gap |
|-------|----------------------|-----------------|--------------------------|---------------------|
| read-candidate | 2.22s | 2.01s | 81.4ms | 23.3ms |
| replace | 5.32s | 3.39s | 1474.9ms | 20.9ms |
| export | 2.70s | 2.58s | 220.6ms | 20.3ms |
| open | 3.96s | 4.72s | 2035.2ms | 69.4ms |
| library-open | 8.34s | 4.88s | 1682.2ms | 21.7ms |
| readonly-open | 7.90s | 5.04s | 1370.3ms | 22.1ms |
| library-switch-large | 7.51s | 5.06s | 1508.8ms | 21.3ms |

All six receipts passed exact live/export/stored/previous hashes. Candidate phases reported zero
Long Tasks in all three pairs. Session open had isolated timer gaps69.4ms and56.4ms; these
receipts remain in the results rather than being discarded. A separate attribution probe then
loaded the same1M-point board six times with continuous RAF observation, both with a fresh UI
snapshot and retaining the prior snapshot: maximum frame interval13.9ms, timer gap27.4ms and
zero Long Tasks. The cause of the two earlier static-timer gaps is unestablished; they were not
reproduced as active-frame stalls. This does not establish a universal worst-case latency bound.

Standalone Session wall time increases because it now prepares successful large recovery copies;
the normal Library path removes duplicate reads/decodes and improves total open/switch time.

Successful loaded recovery snapshots carried100,879,571 logical Blob bytes (about96.2MiB) per
main/backup set, including the small historical library copy. Blob handles avoid a main-thread
raw graph transfer; they still consume backing storage. This is a payload count, not a measured
process RSS/GPU peak. Replacement sent978 point packets for two independent1M-point documents;
export and each owned load used489, with max2048 points/64 ranges and max2 outgoing credits.

Full-pipeline measurement source SHA-256: `4fb151ca27cfdc7232fbe82f3d98171ee75ec144e2eca8e1f99db36c2c29a779`.

Fast Gate:838 unit tests in77 files, lint/architecture/spacing, formatting, types and docs passed.
Four focused browser scenarios passed, including native abort/retry and readonly recovery.

Controlled-GC main UI heap:3,859,348 bytes before import;5,374,952 after replacing the1M-point
board with an empty board;4,106,640 after reload. This is about1.45MiB retained growth before
reload and0.24MiB after reload, below the16MiB guard. Terminated Worker wrapper WeakRefs cleared.
The raw recovery Blob remains intentionally available; these JS heap figures exclude its full
backing storage and do not measure Worker/process/GPU peak.

TypeScript LSP checked66 changed files with zero errors/warnings (11 informational async suggestions).
Independent transport/storage review and the raw-identity escalation review passed.

Owned Playwriter Pages smoke at4220 verified current bundle, import summary5/250, replacement,
current JSON Blob5 items/250 points, exact previous runtime Blob5 strokes, expected unsupported-raw
feedback, desktop/narrow layout and keyboard focus. Native anchor activation was suppressed only
in this owned smoke; isolated Chromium E2E verified actual downloaded files. Browser RPC timeout
runs were recovered by closing/resetting only the owned tab and were not acceptance evidence.

Full Gate initially caught a real-input regression: before-import contained pointerId. The same
known-field Worker clone now runs before persistence and is reused for the recovery Blob; raw
stored-current corruption remains untouched. The original failing browser assertion passes.

The affected1M-point replacement path was then repeated in its first3 warmed alternating pairs
on final source `7c739d3518d76d10d8c197598dac03c78d3a87fb413365df23b7d392c9d250c3`. All six live/stored/previous hashes matched;
new-source maximum UI timer gaps were20.6/19.8/22.4ms across read/replace, with zero Long Tasks.
The broader loader/export/frame evidence above remains applicable to unchanged paths.

Full Gate passed on2026-11-16 after the owner resumed the deliberately interrupted run:

| Check | Result |
|-------|--------|
| Bootstrap / lockfile install | PASS |
| Frontend and Pages builds | PASS |
| Unit tests | PASS —838 tests in77 files |
| Documentation / historical archive | PASS |
| Lint / architecture / spacing / static checks | PASS |
| Formatting | PASS |
| Type-check | PASS |
| Browser suite | PASS —136 Chromium/WebKit tests |
| Owned browser smoke / keyboard / narrow layout | PASS — evidence above |
| Native document performance / integrity / lifecycle | PASS within the measured scope above |
| Secrets scan | PASS |
| Dependency audit | PASS |
| Architect Review Notes / independent review | PASS —0 unresolved |
| Backend / migrations / container / formal accessibility audit | Not applicable or deferred as declared in STACK |

The previous interrupted run is not counted as a passing Full Gate. Physical Wacom and total
process/GPU memory remain outside this automated acceptance.

## Deterministic verification

Regressions cover packed1M transfers, credit stalls/duplicate/future ACKs, all failure/cancel
paths, source sharing/warm reuse, raw formats1–5 and malformed inputs, generic mutation-after-call,
candidate forgery/retry/disposal, asset-ID collisions, corrupt raw backup, transaction abort,
bootstrap/disposal races and readonly recovery snapshots after another writer replaces storage.

Real-browser tests check every sample through import/export/reload/replacement,489 point packets,
max2 outstanding packets, native transaction abort/retry and collection of terminated Worker
wrappers. The large multi-stage test uses a90s aggregate workload limit with unchanged individual
action/assertion timeouts. Observations hash values in their owning realm instead of sending
full records through repeated polls or emitting20k assertion steps. Timing thresholds remain
outside shared CI.

An isolated Chromium CDP fixture requests GC and records UI heap before/after replacing and
reloading the large board. The idle-growth allowance is16MiB; recovery remains a Blob rather than
the old point graph. This verifies retained UI ownership, not total process/GPU memory.

## Limits and reproduction

Use the repository `bench:build` with `PENABLE_BENCH_SOURCE` and `PENABLE_BENCH_OUT` to build
baseline/candidate subdirectories, then `scripts/performance/document-audit.js` in one owned
Playwriter session as described in [STACK](../STACK.md). Local receipts are retained under
`.artifacts/change-42/`; those ignored files are not public assets. Earlier diagnostic receipts
are named explicitly and are not substitutes for the final source/measurement set.

Blocked-Worker startup and emergency export retain intentional synchronous recovery fallback.
Arbitrary unsupported/corrupt records are not promised bounded exceptional fallback latency.
Eager recovery serialization costs Worker time and Blob backing storage; UI responsiveness does
not imply zero memory cost. GPU memory and physical Wacom acceptance remain separate. Extreme
long-stroke raster latency remains the open renderer follow-up from change41.
