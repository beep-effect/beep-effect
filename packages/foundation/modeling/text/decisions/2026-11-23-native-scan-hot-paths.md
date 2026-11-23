---
title: Per-scalar and per-code-unit scans iterate natively over local mutable state
date: 2026-11-23
reversal: Rewrite the governed scans with effect/Array and effect/String helpers over immutable accumulators.
governs:
  - src/internal/scalars.ts#convertBoundaries
  - src/internal/segments.ts#firstEndingAfter
  - src/LocatorMap.ts#composeSegments
  - src/Resolution.ts#advance
  - src/Resolution.ts#prefixTable
  - src/Resolution.ts#scanMatches
  - src/TextNormalization.ts#nfkcRewrites
  - src/TextNormalization.ts#dehyphenateRewrites
  - src/TextNormalization.ts#fromRewrites
enforcedBy: []
---

Unit conversion, normalization and quote search visit every scalar or UTF-16 code unit of a text, and segment lookup runs once per boundary of every re-anchored range and composition cut. These scans use `for...of` string iteration, native string indexing, binary search over an index range, and running offsets and result arrays in local variables.
Module namespace helper calls cost a property lookup per call (a getter call under Vite's module runner); the same boundary is drawn in `@beep/langextract` `VerifiedSpan.behavior.ts`.
Composition walks the cuts of the middle capture once; the cuts are disjoint, so each segment of either map is visited a bounded number of times. The KMP prefix table is the one allocation of a quote scan.
Nothing mutable escapes a call: each returns a `Result`, an immutable array or a schema value.
Rejected: `effect/Array` and `effect/String` helpers on the per-scalar path, which allocate or dispatch per element.
