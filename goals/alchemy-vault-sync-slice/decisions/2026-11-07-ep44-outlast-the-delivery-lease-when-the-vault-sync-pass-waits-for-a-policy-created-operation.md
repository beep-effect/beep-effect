---
title: "ep44: outlast the delivery lease when the vault-sync pass waits for a policy-created operation"
date: 2026-11-07
reversal: "Revert the ep44 PR: restore the 10-second awaitOperation timeout and the 30-second leaseMillis module constant"
---

ep44 red on `main` after #2903: `VaultSyncProcessCrash.test.ts` failed under load (1 in 6 runs locally; hosted unit-d on #2864) when the resumed process exited on `TimeoutError: Operation timed out after '10s'`.

Cause: the `@beep/alchemy-postgres` delivery worker claims outbox rows with a 30-second lease. A SIGKILLed host's claimed rows stay leased to it until that lease lapses; a probe at resume found pending rows still leased for about 28 seconds in 11 of 16 runs. When the in-flight row was the `ItemOperations` delivery, the vault-sync pass's `awaitOperation` gave up after 10 seconds and died, though the system would have recovered by itself once the lease lapsed.

Decision:

- The pass waits up to 2 minutes for a policy-created operation, which outlasts the default lease with margin.
- The lease becomes `AlchemyPostgresConfig.leaseMillis` (default 30 000, unchanged behaviour), so the crash test runs real lease-expiry recovery with a 1-second lease.
- A platform test pins that a row a dead host left leased is not redelivered while leased and is redelivered once the lease lapses.

A plain timeout bump with no driver change was rejected: it would hide the mechanism and leave the crash test racing a 30-second lease against its own budget.
