---
title: Both host stacks keep their state in the shared Alchemy S3 store
date: 2026-11-26
reversal: Point state in alchemy.run.ts and openclaw.alchemy.run.ts at another backend after moving each stack's state out of the shared bucket.
governs:
  - alchemy.run.ts#state
  - openclaw.alchemy.run.ts#state
enforcedBy: []
---

Anchor for `goals/infra-alchemy-rebuild/decisions/2026-11-09-shared-s3-state-store-bootstrap.md` (D6, D17), which records the bucket, its encryption and how credentials reach it. Runbook: `docs/runbooks/alchemy-infra.md`.
