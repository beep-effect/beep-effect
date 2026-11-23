---
title: The oracle suite draws a weighted choice from a Schema ticket and shrinks arrays by length first
date: 2026-11-23
reversal: Replace weighted with a native weighted-choice combinator once effect/Arbitrary ships one, and replace arrayOf only with a combinator that shrinks length before elements.
governs:
  - test/oracle.property.test.ts#weighted
  - test/oracle.property.test.ts#arrayOf
enforcedBy: []
---

effect/Arbitrary has no weighted choice. weighted draws an integer ticket from a Schema and picks the branch whose weight range holds it, shrinking toward the first branch.
arrayOf stays local: it draws a length from a Schema and shrinks that length before the elements.
Rejected: returning to fast-check combinators, which the suite left when it moved to the native module.
Rejected: Arbitrary.array for arrayOf, which shrinks by removing blocks rather than length before elements.
