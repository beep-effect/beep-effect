---
title: The vault-sync intent replay reads and writes through the registry service, dequeuing an answered intent first
date: 2026-11-26
reversal: Read and write the queue, link and confirming atoms through the flush fn's own context, and dequeue only after the follow-up reads.
governs:
  - src/sync/VaultSyncIntent.atoms.ts#vaultSyncFlushAtom
  - src/sync/VaultSyncIntent.atoms.ts#refreshLegacyReads
enforcedBy: []
---

The flush is a concurrent fn atom. A concurrent fn's context is torn down when the fn is triggered again, and its later writes are dropped, so every read and write in the drain goes through the `AtomRegistry` service.
An answered intent leaves the persisted queue before anything else, so nothing can resend it. An accepted intent stays predicted in `vaultSyncConfirmingAtom` until a server read shows its effect; a refused one is no longer predicted and the server state is re-read at once. An accepted probe also triggers a forced connection probe, so the disconnect note reflects Box now rather than the sidecar's cached answer.
Rejected: writes through the fn context (lost on retrigger); dequeuing after the follow-up reads (a retrigger in between resends an answered intent).
