---
title: Vault sync policy handlers record a permanent refusal instead of raising it as a defect
date: 2026-11-26
reversal: Wrap every handler in VaultSync.policy-handlers.ts in Effect.orDie and drop its SyncRuleViolation catches, so a refused send fails the delivery again.
governs:
  - src/aggregates/VaultSync/VaultSync.policy-handlers.ts#itemOperationSlots
  - src/aggregates/VaultSync/VaultSync.policy-handlers.ts#VaultSyncPolicies
enforcedBy: []
---

A dispatch refusal is permanent: the same event and command ids meet the same state. Each handler records it instead: a refused queue marks the item failed (terminal) while its slot keeps the operation id visible, and a refused review correction leaves the conflict open.
`Effect.orDie` stays only on a handler whose sends cannot refuse by construction: ConfirmConflict targets the record's own public id; ReleaseDestinationName (a claim held by another destination is left untouched), SupersedeOperation and ReviveOperation (an operation that is not failed records nothing) never refuse; MarkItemPushFailed meets only the item that emitted the event, so `not-tracked` cannot occur; ConfirmConflictReview's scope comes from the conflict that emitted the event.
Reason: a refusal re-raised as a defect makes the outbox redeliver the committed event forever and blocks the source's later deliveries (goals/alchemy-vault-sync-slice/research/04-vault-sync-domain-design.md).
Rejected: `Effect.orDie` on every handler, which turns each permanent refusal into an endless redelivery.
Accepted limit: the caller mints operation ids, so a replayed or corrupted observation can name an id another item holds or one whose operation has left `queued`; `QueueOperation` then refuses with `not-retargetable` on every redelivery (`operation-key` cannot occur: the key is the target). Such a slot can name another item's operation, so supersession skips operations the item does not own; an operation never changes owner, so that read cannot go stale.
