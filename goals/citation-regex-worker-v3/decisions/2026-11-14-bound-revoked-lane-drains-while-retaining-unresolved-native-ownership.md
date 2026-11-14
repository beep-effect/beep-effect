---
title: "Bound revoked lane drains while retaining unresolved native ownership"
date: 2026-11-14
reversal: "Replace the retained-work drain only with a protocol that preserves quarantine and late confirmed retirement without blocking invocation finalizers."
---

Each withUse call retains admitted operations independently of caller cancellation. After callback revocation, reserve gets queueDeadline, release gets cleanupDeadline, and start gets queueDeadline plus two cleanupDeadline windows for prior-occupant retirement, admission and spawn transfer. These are conservative post-revocation completion budgets from existing policy fields, not new limits. Expiry poisons the lane and quarantines an acquired lease; the outer semaphore is released with typed cleanup-unconfirmed, while the retained operation and its private owner Scope keep unresolved resources. Invocation closure skips unresolved ownership, and late completion releases an unspawned lease or confirms the exact child through NativeProcess before returning capacity. Public retirement cannot release a pending spawn's lease. Interruption during masked drain is acknowledged within the same finite timer window. Callback context carries revocable call frames to reject nesting before lock acquisition, including nested child fibers, without fiber identity. No new spawn is admitted after poisoning.
