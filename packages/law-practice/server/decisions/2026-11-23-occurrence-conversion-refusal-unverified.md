---
title: Every code-point to UTF-16 conversion refusal leaves the citation row unverified
date: 2026-11-23
reversal: Map each conversion refusal reason to its own UnverifiedReason, or fail the projection on a refusal instead of returning none.
governs:
  - src/internal/Citation/OccurrenceProjection.ts#anchor
enforcedBy: []
---

`Citation.verifyOccurrenceSpan` converts an engine span from Unicode code points to UTF-16 code units before it proves the anchor against the verified source.
Every conversion refusal (a split boundary, a point past the text, a lone surrogate before the end) returns none, so the row stays unverified: none of them names a UTF-16 range the source could prove.
Rejected: failing the whole projection, which would let one malformed engine span discard every verifiable row beside it.
