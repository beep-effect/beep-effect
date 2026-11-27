---
title: The prod Worker keeps a pinned physical name
date: 2026-11-26
reversal: Remove productionWorkerName once the S3 state holds a completed Website record; the generated name is then authoritative.
governs:
  - alchemy.run.ts#productionWorkerName
enforcedBy: []
---

Recorded in goals/infra-alchemy-rebuild/decisions/2026-11-12-pin-the-prod-worker-name-adopt-by-name-needed-it.md, which holds the reason and the evidence.

Rejected: the state-generated name, which minted a second prod Worker after the move to the S3 store.

Accepted limit: transitional; the pin goes once the S3 state holds a completed Website record.
