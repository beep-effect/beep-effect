# Vault push-failure design refresh

Reviewed against source `7440cb8c4302ce64b87860069a464bafbf65f576` and corpus main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.

## Finding

`recordPushFailure` at `packages/documents/server/src/aggregates/Sync/VaultSyncEngine.service.ts:1043-1069` derives `requeue` as `error.retryable && incrementedAttemptCount < maxAttempts`. The legal pair states are non-retryable terminal failure, retryable requeue with budget remaining, and retryable terminal failure after budget exhaustion. Requeue without retryability is unreachable, giving four representable and three supported tuples.

The default maximum is three at `VaultSync.config.ts:47-61`; `maxAttempts` is a positive integer and its documented explicit layer accepts one at lines 126-146. Because the operation count increments before comparison, max one exhausts the first failure. Existing tests cover retry-then-success, first non-retryable failure, default-three exhaustion, and vanished-file terminal failure.

The nearby status and numeric fields do not expand the census member set. Attempt counts are numeric inputs rather than flags. The inline status output is exactly queued when `requeue` is true and failed otherwise; leased and succeeded belong to other operation lifecycle transitions. Recording the whole four-status cross-product would exceed the local observation boundary and invent unreachable failure-writer combinations.

## Design and metadata

`goals/boolean-creep/designs/vault-sync-push-failure-disposition.md` designs canonical id `vault-sync-push-failure-disposition` with members `[retryable,requeue]`, cardinality 4/3, evidence E4 at `VaultSyncEngine.service.ts:1049-1059`, storage derived, exposure internal, target shape literalkit, and Tier 1.

The target reuses the existing `SyncOperationStatus` LiteralKit directly. It selects queued or failed from retryability and the post-increment budget, writes that literal to the operation, and guards the terminal item update with `SyncOperationStatus.is.failed`. This deletes the `requeue` alias, its ternary projection, and its negated guard without adding another state domain.

`DmsMirrorUnavailable.retryable` remains on the typed error because it is an independent adapter policy input used by this decision. Its reason, provider, optional disconnect classification, and encoded contract do not change. Persisted status strings, attempt count, error reason, operation-before-item update order, same-pass scheduling, failed-operation revival, and repository schemas remain exact.

## Parent reconciliation recommendation

Admit the corrected record under canonical id `vault-sync-push-failure-disposition` as 4/3, derived/internal/literalkit/Tier 1 with E4 evidence. Do not combine it with the separately disqualified `DmsMirrorUnavailable` retryability/disconnect-reason record and do not add the global `SyncOperationStatus` or numeric limits as census members.

## Verification

Independent P3 review remains pending. `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passed with `design coverage OK: 156 qualified ids`; scoped `git diff --check` passed for the design and this handoff.
