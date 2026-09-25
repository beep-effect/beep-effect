# Instance

- id: `vault-sync-push-failure-disposition`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1050`
- symbol: `recordPushFailure.requeue`
- members: `retryable`, `requeue`
- evidence: E4 at `VaultSyncEngine.service.ts:1049-1059` — `requeue` is `error.retryable && attemptCount < config.maxAttempts`, so requeue implies retryable at the sole producer.

# Current shape

`recordPushFailure` receives a `DmsMirrorUnavailable`, increments the persisted operation attempt count, and derives the transient `requeue` boolean at lines 1043-1050. It then maps that boolean to the existing persisted `SyncOperationStatus` literals `queued` or `failed` at lines 1051-1057. The second read at lines 1059-1068 marks the item `error` only for a terminal failure.

`DmsMirrorUnavailable.retryable` remains an independent adapter policy field in `packages/documents/use-cases/src/aggregates/Sync/Sync.errors.ts:36-57`; its optional disconnect classification is unrelated. The mirror path supplies those errors at `VaultSyncEngine.service.ts:1104-1107`. A vanished local file is normalized to an explicitly non-retryable mirror error at lines 1108-1120 so the leased operation cannot wedge the queue.

The numeric budget is a real input rather than another bit in this cluster. `attemptCount` is persisted as a nonnegative integer at `packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts:64-91`. `maxAttempts` is positive, defaults to three, and supports an explicit value of one at `VaultSync.config.ts:47-61,98-110,126-157`. The comparison occurs after incrementing, so `maxAttempts = 1` exhausts the first failed attempt.

# Cardinality gap

Two booleans represent four tuples. Three are supported:

| retryable | requeue | decision |
| --- | --- | --- |
| false | false | terminal `failed` |
| true | true | remaining budget, `queued` |
| true | false | exhausted budget, `failed` |

False/true is unreachable. Budget state distinguishes the two retryable rows but is not itself stored as a boolean: it is the comparison of the incremented `attemptCount` with `maxAttempts`.

The inline status projection is part of this decision's output, not an additional census axis. Within `recordPushFailure` it can only be queued or failed and is determined one-to-one by `requeue`. Expanding the record across the complete four-value persisted `SyncOperationStatus` would manufacture combinations with `leased` and `succeeded` that this failure function never writes. The meaningful observation boundary is therefore the transient pair at its sole derivation, with the existing two status literals as its replacement.

# Target schema

Reuse `DomainSyncOperation.SyncOperationStatus.Enum.queued` and `.failed` directly. Replace `requeue` with one local `status` whose inferred domain is the queued/failed subset:

- retryable with incremented attempt count below the configured maximum selects queued;
- every other failure selects failed.

Write that status to the operation, then use `SyncOperationStatus.is.failed(status)` for the terminal item update. This consumes the existing named LiteralKit rather than adding another schema, boolean bag, retry disposition, or cross-product of the complete operation lifecycle.

# Migration inventory

- `packages/documents/domain/src/entities/SyncOperation/SyncOperation.values.ts:47-73` — reuse the existing `SyncOperationStatus` LiteralKit and exact `queued`/`failed` encoded values; retain `leased` and `succeeded` for their unrelated lifecycle writers.
- `packages/documents/domain/src/entities/SyncOperation/SyncOperation.model.ts:64-91` — no schema edit; preserve persisted `attemptCount`, `lastError`, and status columns and indexes.
- `packages/documents/server/src/aggregates/Sync/VaultSync.config.ts:47-61,98-110,126-157` — no edit; preserve default three, positive-integer decoding, environment override, and explicit test-layer configuration including one attempt.
- `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1043-1069` — replace `requeue` and both boolean reads with one queued/failed status selection and failed-status guard. Preserve increment-before-comparison, operation update before item update, exact error reason in both rows, and the item-ref update.
- `VaultSyncEngine.service.ts:1101-1123` — no sequencing edit; preserve leasing before the remote verb, successful push handling, mirror error handling, vanished-file normalization, and the returned progress signal.
- `VaultSyncEngine.service.ts:1126-1150` — preserve FIFO pump behavior so a requeued operation may retry in the same pass while a terminal failure leaves no queued work.
- `VaultSyncEngine.service.ts:1402-1448` — no edit; failed-operation revival is a later convergence policy that resets the attempt budget and status and is not part of the immediate failure decision.
- `packages/documents/use-cases/src/aggregates/Sync/Sync.errors.ts:17-57` — no edit; retain `DmsMirrorUnavailable.retryable`, reason, provider, optional disconnect reason, encoded shape, and typed-error identity.
- `packages/documents/server/test/VaultSyncEngine.test.ts:380-446` — retain retry-then-success, non-retryable terminal failure, and default-three exhaustion coverage; add the explicit max-one first-failure boundary.
- `packages/documents/server/test/VaultSyncReviewRegressions.test.ts:142-188` — retain vanished-file terminal failure and no-wedge coverage.
- Sync operation repository and PGlite tests — no shape edit; retain queued/leased/succeeded/failed storage and query behavior.

Targeted source and barrel search found no other reader or writer of the local `requeue`. Other functions named requeue operate on persisted leased/failed records and do not share this local decision.

# Guard-deletion accounting

Delete `const requeue` at line 1050, the `requeue ? "queued" : "failed"` projection at line 1056, and the negated `if (!requeue)` guard at line 1059. One status derivation and the existing `SyncOperationStatus.is.failed` guard replace them. Keep the retryability field on `DmsMirrorUnavailable`, the incremented numeric attempt count, and the budget comparison because they are independent source facts needed to choose the outcome.

# Encoded-side impact

None for the changed carrier. `requeue` is a private local and is never encoded or persisted. The operation continues to persist the exact existing strings `queued` and `failed`, exact incremented attempt count, and exact error reason; the item continues to persist `error` and the same reason only for terminal failure. The full operation-status schema, database columns, indexes, repository contracts, and all existing rows remain unchanged.

# Test impact

Preserve the current assertions that a retryable first failure under the default-three budget retries in the same pass and succeeds with attempt count one; a non-retryable first failure writes failed, marks the item error, and copies the reason; and three retryable failures exhaust the default budget at count three. Add an explicit `VaultSyncConfig.layerConfig` case with `maxAttempts = 1` proving a retryable first failure goes directly to failed and marks the item error. Retain the vanished-file non-retryable case and assert no leased row remains.

Where repository fixtures expose updates, assert operation update occurs before the terminal item update, queued failures do not mark the item error, and failure reasons remain exact. No browser QA is required for this server-only decision.

# Risk and sequencing

Tier 1 internal derived refactor. Although the selected status is persisted, the changed carrier is the transient `requeue` decision; the persisted status model and bytes do not change. The main risks are comparing before increment, changing `<` to `<=`, marking requeued items as error, or altering the same-pass retry schedule. No new schema, state, dependency, generated file, wire migration, or status cross-product is introduced.
