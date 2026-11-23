---
title: The oracle suite builds weighted choice and variable-length arrays from flatMap over a Schema-generated ticket or length
date: 2026-11-23
reversal: Replace weighted and arrayOf with native effect/Arbitrary combinators once the module offers a weighted choice and an array of an arbitrary Arbitrary.
governs:
  - test/oracle.property.test.ts#weighted
  - test/oracle.property.test.ts#arrayOf
enforcedBy: []
---

The native `effect/Arbitrary` module has no weighted choice and no array-of-Arbitrary combinator; it builds collections only from Schemas.
So `weighted` draws an integer ticket from a Schema and picks the branch whose weight range holds it, and `arrayOf` draws a length from a Schema and collects that many draws.
Both shrink the way the earlier fast-check suite did: a weighted pick shrinks toward its first branch, and a collection shrinks its length before its elements.
Rejected: returning to fast-check combinators, which the suite left when it moved to the native module.
