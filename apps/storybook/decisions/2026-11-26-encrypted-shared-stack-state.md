---
title: encrypted shared stack state
date: 2026-11-26
reversal: Use local state or a separate unencrypted state bucket per stack.
governs:
  - alchemy.run.ts#state
enforcedBy: []
---

Use the shared account-regional S3 state bucket alchemy-state-<accountId>-<region>-an, with AWS-managed SSE-KMS, bucket keys enabled and customer-provided keys blocked.
Account, region and credentials come from the environment: aws-vault on workstations or the GitHub OIDC state role in CI. See docs/runbooks/alchemy-infra.md.
Rejected: local or per-stack unencrypted state, which loses the shared durable coordination and encryption policy.
