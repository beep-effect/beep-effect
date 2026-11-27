---
title: State lives in the shared account-regional S3 store under the AWS-managed KMS key
date: 2026-11-26
reversal: Drop the encryption override, or move the stack to another backend after destroying its stages.
governs:
  - alchemy.run.ts#state
enforcedBy: []
---

Recorded in goals/infra-alchemy-rebuild/decisions/2026-11-09-shared-s3-state-store-bootstrap.md (D6, D17), which holds the bucket, bootstrap and credential details; CI never creates the bucket.

Rejected: a customer-managed KMS key, which needs a key-policy grant for the CI state role and a key to bootstrap before the store.
