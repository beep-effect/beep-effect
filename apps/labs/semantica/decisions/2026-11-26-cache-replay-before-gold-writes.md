---
title: Generate all cache-only proposals before rewriting gold artifacts
date: 2026-11-26
reversal: Delete or rewrite the committed gold artifacts incrementally before checking all provider-cache entries.
governs:
  - src/canary/Gold.ts#generateJobProposal
enforcedBy: []
---

Generate every selected proposal from canonical text and decoded output before touching any artifact files. Replay is cache-only.
Reason: a missing cache entry or invalid response in a fresh checkout must fail before invalidating gold.json or rewriting any labels.
Rejected: incremental destructive generation, which can leave committed labels partially rewritten on a later replay miss.
