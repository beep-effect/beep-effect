---
title: A non-idempotent write is retried only after a rate limit
date: 2026-11-26
reversal: Retry every request under the configured RetryPolicy, whatever its method or operation type.
governs:
  - src/internal/octokit.ts#makeTransport
  - src/internal/octokit.ts#writeSafetyOfRoute
  - src/internal/octokit.ts#writeSafetyOfDocument
enforcedBy: []
---

A REST `POST` or `PATCH`, or a GraphQL mutation, is retried only when it failed `rateLimited`. Reads and idempotent writes keep the full retry policy.
Reason: GitHub refuses a rate-limited request before doing anything, but an ambiguous transport failure may follow a write GitHub already applied. Retrying it risks a second comment, reply or object.
Rejected: the full policy for every request, which duplicates writes after a lost response.
