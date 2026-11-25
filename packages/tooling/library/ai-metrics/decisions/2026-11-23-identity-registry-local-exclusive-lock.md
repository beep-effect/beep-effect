---
title: The identity registry holds its own bounded exclusive-create lock across the whole read-merge-write
date: 2026-11-23
reversal: Import the Yeet proof lock from @beep/repo-cli, or hold the lock only around the rename, or wait on it without a retry bound.
governs:
  - src/identity-registry.ts#claimRegistryLock
  - src/identity-registry.ts#acquireRegistryLock
  - src/identity-registry.ts#upsertAiMetricsIdentityRegistry
enforcedBy: []
---

The registry lock is an exclusive create (`flag: "wx"`, O_CREAT | O_EXCL), the
idiom the Yeet proof lock uses, written here because @beep/repo-cli depends on
this package and importing it back would cycle. The lock spans the read as well
as the write: two writers that read the pre-merge snapshot each merge without
the other's roots, and the later rename discards the earlier one. Retries stop
after about one second (50 x 20 ms), long enough for a healthy writer.
Rejected: importing the Yeet lock (dependency cycle); a write-only lock (the
lost-update window opens at the read); an unbounded wait (a lock left by a dead
holder hangs every later run).
Accepted limit: a dead holder's lock fails the upsert loudly, naming the lock
path, until an operator removes it; skipping the upsert would leave provenance
that does not match the data.
