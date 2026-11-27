---
title: Per-cluster normalization results are memoized for one normalization call, with short keys only
date: 2026-11-26
reversal: Drop memo() and MAX_MEMO_KEY_LENGTH and compute clusterForm, nfkcFormStartsWithMark and joinsCluster for every occurrence.
governs:
  - src/VerifiedSpan/VerifiedSpan.normalization.ts#MAX_MEMO_KEY_LENGTH
  - src/VerifiedSpan/VerifiedSpan.normalization.ts#memo
  - src/VerifiedSpan/VerifiedSpan.normalization.ts#scanPoint
enforcedBy: []
---

Hostile inputs repeat a few distinct short clusters, so each pure per-cluster computation runs once per distinct raw text instead of once per occurrence. Every cache lives for one normalizeWithRawOffsets call.
Keys longer than MAX_MEMO_KEY_LENGTH are computed directly, so a hostile long cluster never retains a large key.
A code point whose normalized form starts with a combining mark always joins, so the join verdict, which normalizes the whole open cluster, runs only for other code points. Its memo key is the open cluster followed by exactly one code point, which fixes both inputs of the verdict.
Rejected: recomputing every cluster per occurrence, and one unbounded cache shared across calls.
