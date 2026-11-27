---
title: The per-code-unit locator scans use native indexing, in-place arrays and loops, not Effect helper modules
date: 2026-11-26
reversal: Rewrite nextMatchedLength, prefixTable, alignsWithRawClusters and the normalization scan with effect/Array and effect/String helpers and a recursive KMP fallback, then re-measure hosted CI time on a 1,000,000-unit source.
governs:
  - src/VerifiedSpan/VerifiedSpan.behavior.ts#nextMatchedLength
  - src/VerifiedSpan/VerifiedSpan.behavior.ts#prefixTable
  - src/VerifiedSpan/VerifiedSpan.behavior.ts#alignsWithRawClusters
  - src/VerifiedSpan/VerifiedSpan.normalization.ts#getMemoized
  - src/VerifiedSpan/VerifiedSpan.normalization.ts#normalizeWithRawOffsets
enforcedBy: []
---

The KMP scan and the normalization scan visit every UTF-16 code unit of a source up to 1,000,000 units long. They index strings and arrays natively, bind helpers at module scope, append in place and walk the KMP prefix chain in a loop.
Reason: a module-namespace helper call costs a property lookup per call (a getter call under Vite's module runner), which dominated hosted CI time. The prefix chain can be as long as the NFKC-normalized locator, several times MAX_LOCATOR_LENGTH (U+2026 expands to three code units), so a recursive fallback could overflow the stack; the matched length stays below the locator length, so both reads stay in bounds.
Mutation stays inside the call that builds a value: the prefix table and a completed NormalizedTextWithRawOffsets are never written after construction returns.
A native read past either end of an offset map yields undefined, which never equals a raw offset, so alignsWithRawClusters treats both text edges as cluster boundaries.
Rejected: effect/Array and effect/String helpers with Option-returning reads on the per-unit path, and a recursive KMP fallback.
