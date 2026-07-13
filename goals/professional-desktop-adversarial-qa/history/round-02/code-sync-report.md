## Findings

### R2-SYNC-01 — P1 — conflict review races with sync and can create an invisible, permanently conflicted item

[VaultSyncEngine.service.ts:1326](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1326)

`markConflictReviewed` does not acquire the workspace semaphore used by `syncOnce`, and the conflict and item mutations are not atomic.

Failure scenario:

1. `syncOnce` records a remote event conflict at line 1050.
2. Before it updates the item to `conflict` at line 1053, the user marks the conflict reviewed.
3. Review changes the conflict to `reviewed`; `requeueReviewedConflictItem` sees the item still `current`, so its state filter skips the requeue.
4. The sync fiber resumes and sets the item to `conflict`.
5. The item now contributes to `conflictItems`, but the reviewed conflict is absent from `listOpen`; the UI offers no way to recover it.

A repository failure after `markReviewed` but before the item update produces the same split state.

Recommended fix: run review under the same per-workspace semaphore and make “review conflict + transition associated item” one repository transaction. At minimum, update/requeue the item before hiding the conflict and compensate if the second mutation fails. Add a barrier-controlled concurrency regression test for the interleaving above.

### R2-INTAKE-02 — P1 — the 25 MB limit does not protect the RPC or server boundary

[DocumentIntakeTarget.tsx:321](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:321)

The bound exists only in the React file picker/drop path. `IntakeDroppedFilePayload.content` and the server handler accept an unbounded base64 `Uint8Array`.

Failure scenario: another desktop RPC caller, a compromised renderer, or a future intake client sends a several-hundred-megabyte base64 payload directly. The sidecar decodes it, hashes it, runs extraction, and materializes it with multiple in-memory copies, potentially exhausting renderer or sidecar memory despite the advertised protection.

Recommended fix: enforce the byte limit in the payload schema or immediately after RPC decoding, before extraction/hash/materialization. Ideally also enforce an HTTP/RPC encoded-body limit that accounts for base64 expansion.

### R2-SYNC-03 — P2 — one transient Box probe failure forces a false disconnect for 30 seconds

[DmsMirrorBox.ts:761](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/DmsMirrorBox.ts:761)

`cachedWithTTL` correctly coalesces concurrent callers, so there is no per-layer thundering herd. However, it caches failed exits for the full TTL.

Failure scenario: the first probe after expiry encounters one timeout or 503. Every status request for the next 30 seconds receives that cached failure, the badge flips to disconnected, and `VaultSyncPanel` disables “Sync now,” even if Box recovered immediately.

Recommended fix: cache successful probes for 30 seconds but use a much shorter failure TTL, or retain the last successful result while revalidating and expose a separate stale/degraded state. Add clock-driven tests covering success → transient failure → immediate recovery.

### R2-SYNC-04 — P2 — conflict review performs a workspace-wide read for a single item

[VaultSyncEngine.service.ts:1303](/home/elpresidank/YeeBois/projects/beep-effect6/packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1303)

Every review loads and materializes every Box sync item in the workspace, sorts them in the repository, and then performs a linear search.

Failure scenario: a large vault with hundreds of thousands of tracked entries makes a single “Mark reviewed” action transfer and allocate the full workspace item set. The UI remains in `reviewingId` state until this completes, while concurrent sync work increases repository contention and widens R2-SYNC-01’s race window.

Recommended fix: add a workspace/provider-scoped `findById` or conditional update such as `transitionState(id, conflict, pending)`. The conditional update also provides safer compare-and-set semantics.

### R2-INTAKE-05 — P2 — the size bound permits unbounded batch count and cumulative payload

[DocumentIntakeTarget.tsx:315](/home/elpresidank/YeeBois/projects/beep-effect6/apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:315)

Each file is bounded, but neither file count nor total accepted bytes is bounded. Rejections also append one React state update and one persistent result row per file.

Failure scenario: dropping thousands of 24–25 MB files initiates a very long sequence of RPC/extraction/materialization operations; dropping thousands of oversized files creates thousands of state updates and DOM rows. The renderer can become unusable although every individual file satisfies—or is rejected by—the new bound.

Recommended fix: preflight the entire selection before changing batch state, cap both file count and total accepted bytes, and append rejection results in one state update. Clearly report which files were accepted if partial batches remain intentional.

## Findings table

| id | severity | file:line | summary | failure scenario | fix |
|---|---|---|---|---|---|
| R2-SYNC-01 | P1 | `VaultSyncEngine.service.ts:1326` | Conflict review races with sync and is non-transactional | Reviewed conflict disappears, then concurrent poll leaves its item permanently conflicted and invisible | Share the workspace lock and transactionally review plus transition the item |
| R2-INTAKE-02 | P1 | `DocumentIntakeTarget.tsx:321` | Intake limit is client-only | Direct oversized RPC payload exhausts sidecar memory | Enforce decoded and encoded limits at RPC/server boundaries |
| R2-SYNC-03 | P2 | `DmsMirrorBox.ts:761` | Probe failures are cached for 30 seconds | One transient outage disables sync and flaps the badge for the full TTL | Cache successes longer than failures or use stale-while-revalidate |
| R2-SYNC-04 | P2 | `VaultSyncEngine.service.ts:1303` | Reviewing one conflict scans every workspace item | Large vault makes review slow and increases contention | Add scoped `findById` or conditional state transition |
| R2-INTAKE-05 | P2 | `DocumentIntakeTarget.tsx:315` | Batch count and cumulative bytes are unbounded | Huge selections monopolize intake or create thousands of result rows | Preflight and cap count/total bytes; batch result updates |

## Clean areas

- `pruneUndefined` correctly recurses through arrays-of-arrays.
- `null` is preserved rather than treated as absent.
- `Date`, `Buffer`, streams, and other non-plain instances pass through unchanged.
- Copy-on-write identity is preserved when no descendant changes.
- `__proto__` copying avoids the legacy prototype setter.
- `cachedWithTTL` coalesces concurrent callers within the layer; no local thundering herd was found.
- The semaphore releases permits through `withPermit`; no intrinsic semaphore deadlock was found.
- Sequential conflict review does converge: pending recovery queues the appropriate local-wins operation, and the stored event cursor prevents the reviewed event itself from being replayed.
- Mixed accepted/rejected intake files produce explicit per-file results; no hidden renderer state was found, although the operation is intentionally non-atomic.
- `git diff --check` was clean for the reviewed scope.


Codex session ID: 019f553c-1e72-7450-93a8-511d97094a4e
Resume in Codex: codex resume 019f553c-1e72-7450-93a8-511d97094a4e
