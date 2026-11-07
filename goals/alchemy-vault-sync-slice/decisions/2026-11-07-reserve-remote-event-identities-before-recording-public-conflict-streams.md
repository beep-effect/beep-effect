---
title: "Reserve remote event identities before recording public conflict streams"
date: 2026-11-07
reversal: "Replace the registry with a native uniqueness primitive while retaining conflict stream ids"
---

ConflictEventRegistry is keyed by destination and atomically reserves remoteEventId. Its idempotent policy records SyncConflict at the existing public id. This preserves D14 while enforcing I8; review intent queues correction before the conflict closes. Lease expiry additionally uses a monotonic leaseEpoch separate from the resettable retry budget.
