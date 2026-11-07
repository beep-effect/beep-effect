---
title: "Offline intents queue in the renderer; the trigger carries a stable intent id"
date: 2026-11-07
lane: "feat/vault-sync-offline-intents"
reversal: "Drop the intentId payload key and the intent queue; commands go back to fire-and-report"
---

The renderer records every vault-sync command (trigger, conflict review) as an intent in a localStorage-backed queue (`vaultSyncIntentQueueAtom`) before sending it, and shows its prediction at once (pass queued; conflict reads reviewed). An unreachable sidecar keeps the intent queued; a mounted replay loop delivers the queue oldest first every two seconds; a typed `VaultSyncActionError` drops the intent and reverts its prediction with the server message. `TriggerVaultSync` gains an optional `intentId` (`RequestToken`); the Api adapter uses it as the request id and sends `commandId: vault-sync-intent:<id>`, so the destination dedupes a replayed trigger. Review is already idempotent (one heal operation id per conflict). Prediction stays at panel level: the renderer holds legacy rows, not `SyncConflict` aggregate state, so `Aggregate.predict` is not used yet; revisit when the panel reads the alchemy Views directly.
