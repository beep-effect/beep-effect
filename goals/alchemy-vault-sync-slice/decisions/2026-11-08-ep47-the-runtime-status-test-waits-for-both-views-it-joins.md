---
title: "ep47: the runtime status test waits for both views it joins"
date: 2026-11-08
reversal: "Revert the VaultSyncRuntime.pglite.test.ts wait condition to openConflicts === 1 only"
---

ep47: hosted `Test Unit (unit-d)` failed on #2923 in `VaultSyncRuntime.pglite.test.ts > model writer > admits once at startup and serves the desktop RPCs over the projected tables` (job 128591945570). `assertSome(status.cursorPosition, "0")` received `None`.

Cause: `GetVaultSyncStatus` (`VaultSyncRpcs.api.ts`, `statusOf`) joins two views that catch up independently. `openConflicts` comes from `OpenConflicts`, and `cursorPosition` comes from the destination in `VaultSyncStatus`. The test's `eventually` waited only for `openConflicts === 1`, so under load it could read before the destination view held the cursor. Locally on `main` 0c1b780e56 the test passed 6/6 on bun and 6/6 on node; with 16 concurrent bun runs it failed 3/16 with the hosted assertion.

Decision: the test waits for `openConflicts === 1 && O.isSome(cursorPosition)`. This is test-only. Briefly reading a conflict count ahead of the cursor is the intended eventual consistency of two Views, not a product defect. After the fix: 16/16 concurrent bun runs and 6/6 node runs pass. The fix rides in the observability final PR, as the orchestrator agreed.
