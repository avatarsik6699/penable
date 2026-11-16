# CHANGE 42 — Bounded document transfer and replacement

## Change Metadata

| Field | Value |
|-------|-------|
| Change | `42` |
| Slug | `bounded-document-transfer` |
| Title | Bounded document transfer and replacement |
| Status | `active` |
| Branch | `feature/42-bounded-document-transfer` |

## Goal

Complete the approved independent document-processing follow-up to b9898ea: pack small sources,
bound queued messages in both directions, avoid production whole-document handoffs and repeated
import/backup copying. Preserve strict validation, exact data, snapshots, recovery and durable
authority. Change41 failed its native renderer feasibility gate and remains explicitly open;
this change contains no rejected renderer implementation and cannot claim to fix long strokes.

## Backlog

### Frontend
- [x] `F1` Pack validated points across source identities into2048-point/64-range transferable batches and enforce two-packet ACK windows in both directions; preserve warm-cache identity, cancellation, errors and close. — _Depends on:_ T1
- [x] `F2` Add an explicitly owned stored-record decoding stream for production formats1–5; keep generic mutable Reader.decode/prepare snapshot semantics and strict fallback for exceptional unsupported structures. — _Depends on:_ F1
- [x] `F3` Introduce private validated import candidates with coarse summaries and safe lifetime/retry; remove production candidate recopy/revalidation while retaining generic replace(BoardDocument) behavior. — _Depends on:_ F1
- [x] `F4` Move production atomic backup/replacement to the serialized durable Worker through an optional persistence port; preserve previous/candidate asset scopes, raw-corrupt backup and drain-before-lease-release. — _Depends on:_ F1, F3
- [x] `F5` Remove native main-thread IndexedDB record materialization: optional production Worker-owned immutable record snapshots, strict decode once, packed DTO return, same prepared load reused by library/session, Worker bootstrap and async exact recovery Blobs. Keep generic adapters and blocked-Worker fallback. — _Depends on:_ F1, F2, F3, F4
- [x] `F6` Detach shared known wire matrix arrays only in the Worker recovery-copy projection so ordinary multi-stroke records can produce exact JSON Blobs; preserve every raw field/descriptor and keep generic raw serializer/cycle/corruption guards unchanged. — _Depends on:_ F5
- [x] `F7` Reuse the detached known-field previous snapshot for both durable backup and recovery Blob so completed pointer metadata is never persisted; retain exact stored-current corruption. — _Depends on:_ F4

### Infrastructure
- [x] `I1` Add deterministic work/integrity regressions to existing checks and document benchmark, queue bounds, renderer rejection and remaining limits. — _Depends on:_ F1, F2, F3, F4, F5, F6, F7, T2

### Other
- [x] `T1` Pin b9898ea baseline and instrument real packed transport, whole application phases and owned resource/memory lifetimes. — _Depends on:_ —
- [x] `T2` Complete first3 valid warmed native pairs, exact1M-point import/export/open/replace/reload, cancellation/failure/memory scenarios and required tool checks. — _Depends on:_ F1, F2, F3, F4, F5, F6, F7
- [x] `T3` Independent review and Fast/Full Gate acceptance for local ship; Pages release follows the owner's renderer-scope decision. — _Depends on:_ I1

## Files

### Create / modify
- `src/features/board-document/` — transfer/credit/candidate/owned-reader/replacement ports, integration and tests.
- `src/widgets/board-workspace/model/`, `adapters/` — import candidate composition and narrowly required tests.
- `src/shared/lib/messages/` — existing typed feedback keys preferred; only required errors if missing.
- `scripts/performance/`, `e2e/` — real application phase/transport/integrity/resource fixtures and Page Objects.
- `scripts/architecture/` — exact platform/worker owner changes and tests if needed.
- `docs/SPEC.md`, `docs/FRONTEND.md`, `docs/STACK.md`, `docs/KNOWN_GOTCHAS.md`, `docs/performance/41-long-stroke-raster.md`, `docs/performance/42-bounded-document-transfer.md`, `docs/changes/41-long-stroke-raster.md` — approved contracts, failed feasibility record and measured evidence.

### Do NOT touch
- Pen/eraser renderer or geometry, rejected change41 source, persisted document5/catalog2/IDB1
  schemas, quality, samples, personal notes/origins, dependencies or unrelated UI.

## Contracts

See SPEC3–5 and FRONTEND document/session/native ownership. Internal packed point messages contain
id/sequence/Float64Array and ranges(geometry,length,offset,start,count), max2048 points/64 ranges.
Metadata max64 items, flush at2048 estimated mask vertices (one legal larger mask remains atomic);
assets max65536 characters. Two unacknowledged data packets per stream; ACK after acceptance,
drain before finish, ignore stale/duplicate ACKs and reject impossible future sequences. Register
waiters before posting; reject all waiters on cancel/reset/failure and commit cache knowledge only
after final success. Never detach source buffers or coerce unvalidated data into numeric arrays.

Generic mutable Reader and Session.replace APIs retain synchronous snapshot detachment. Production
decodeOwned accepts only a storage-owned detached record, immutable during processing. Stream raw
schema-shaped entries preserving holes, missing/undefined, forbidden keys and invalid types before
the unchanged strict decoder. Unsupported/nonplain/cyclic/oversized metadata uses the unchanged
strict generic fallback; exceptional arbitrary corruption is not claimed to have bounded latency.

ImportCandidate is opaque: private validated DTO plus frozen summary; no mutable external alias.
Retry after a failed confirmation retains the candidate; successful replacement/close/stale read/
unmount disposes it. Generic document replacement remains independently strict.

Production replacement shares the durable writer tail and captures root/list/settings over
immutable completed sources. Keep previous/candidate asset namespaces separate. For unloaded raw
corruption, copy the existing stored value inside the same Worker readwrite transaction, never
normalize it. Resolve only on transaction.complete; once durable work starts it drains on disposal
before repository close and origin lease release. Selection/reader cancellation cannot cancel it.

Production loading owns raw records in a dedicated Worker snapshot. The Worker captures exact
recovery Blobs or the unchanged raw serializer's error, plus primitive schema flags. Opaque
recovery copies never look up a later storage key and remain usable after loader termination.
The Worker reads the same recovery set, strictly decodes once, and returns the validated DTO in
bounded packets. Library validation/preflight precede catalog switching; Session reuses that
same prepared load. Initial library bootstrap uses retained raw/validated data inside the loader
Worker. Loaded-memory replacement captures its previous recovery Blob in the durable Worker and
publishes it only after transaction completion; preserve raw representation instead of silently
substituting normal document export. Generic injected repository/session APIs retain detached
values and their existing behavior. Unavailable Workers retain strict startup/emergency fallback.
Started bootstrap/durable work drains before loader/repository close and lease release; stale or
failed loads/exports must not leak owners or publish into a new board generation. Measure eager
recovery serialization time and Blob/heap peak as well as UI responsiveness.

F6's projection preserves raw JSON values and unknown fields. It duplicates only validated-shape
six-number matrix arrays in schema4/5 item metadata, without changing stored records or encoding
through the document codec. Preserve sparse arrays, property descriptors, symbols, forbidden
fields, unsupported prototypes and cycles so the existing serializer still rejects unsupported
records. Generic serializeRawBackup retains its prior contract. Final timings must include large
successful recovery Blobs, not merely early error results from aliased identity matrices.
An optional recovery-only canonical-identity map restores cloned containers' original identities
during the existing seen checks. It can merge identities, never split repeated actual objects;
the default one-argument serializer and all descriptor/type/cycle validation remain unchanged.

## Gate Checks

Standard [STACK.md](../STACK.md) gates plus owned native/application measurements. Baseline source
in `.artifacts/change-42/baseline/src`; benchmark4180, own application4220, E2E4185. Exact1M-point
roundtrip;20k×50 sources require489 point packets and max2 unacknowledged data packets. Exercise
stalled/duplicate/stale/future ACKs, full-credit cancellation, constructor/post/message/worker
errors, warm sources/undo reuse, all formats1–5 and malformed wire values, generic mutation-after-
call, forged/stale candidates, image preflight failures, same asset ID/different bytes across
backup/candidate, raw corrupt backup and atomic abort. Preserve blocked-worker startup/emergency
export fallback. Target no reproducible attributable >=50ms UI processing pauses in the1M-point
document pipeline. Run timing separately from integrity serialization and raster readback.
No timing threshold in shared CI; deterministic queue/work/data/lifetime limits are required.
Browser JS retained-memory can use isolated Chromium CDP; report GPU and physical Wacom separately.

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

- The approved change41 dirty replay strategy failed strict native parity and timing; its
  experimental source is quarantined, not silently enabled or described as complete.
- F5 follows measured native IndexedDB deserialization stalls (668ms and584ms on main plus backup)
  after F1–F4 had already reduced import/replacement/export UI gaps to16–19ms. Bounded postMessage
  alone could not remove those reads. No timing target was relaxed.
- F6 follows a baseline ownership defect: identity transforms are stored as shared matrix arrays,
  while generic raw serialization rejects repeated references. A narrow detached recovery
  projection fixes ordinary copies without weakening arbitrary-corruption validation.
- Full Gate found a real-input-only regression: durable before-import retained pointerId from
  completed runtime ink, unlike the former main-thread clone. F7 moves the same known-field
  detachment before persistence and reuses it for the recovery Blob; no new main-thread clone.

## Commit Message

```
fix(document): bound transfer and durable recovery work
```

