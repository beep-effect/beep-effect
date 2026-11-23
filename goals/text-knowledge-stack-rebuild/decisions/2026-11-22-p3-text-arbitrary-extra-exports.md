---
title: "P3: @beep/text/Arbitrary also serves scalarRangeIn, textDigestOf and wellFormedTextOf, with the digest as the first curried argument"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Keep only the four named generators in src and copy the range, digest and boundary helpers into each test support under a duplication waiver, by a decision file"
---

Decision `p3-text-arbitraries-in-src` names four generators for `@beep/text/Arbitrary` (`wellFormedTextWith`, `rangeIn`, `sourceFor`, `anchoredOn`) and says they take a `JsoncDigest` argument. Three more move with them, and the digest is the first, curried argument.

- `scalarRangeIn` draws the scalar-index range that `rangeIn` turns into offsets. Without it, `rangeIn` alone gives the annotation generators no range on scalar boundaries, so they would rebuild it.
- `textDigestOf(digest)(text)` is the digest `sourceFor` writes as the capture's `textDigest`. The annotation generators need it for captures built from a document's text, as the design module's `mint.textDigest` does today.
- `wellFormedTextOf(codePoints)` is the text-and-boundaries builder behind `wellFormedTextWith`. The narrow-alphabet and overlapping-repeat generators that stay in `packages/foundation/modeling/text/test/support/generators.ts` build their text through it, so the builder is not copied.

`sourceFor(digest)(text)` and `textDigestOf(digest)(text)` take the digest first, so a test or generator fixes it once at module scope. `rangeIn` reads boundaries with `A.getUnsafe`, so the module has no unreachable fallback and its four coverage measures stay at 100 percent from the text tests alone. The narrow alphabet, the normalization pieces, `locatorStep`, `anchoredCase` and the platform SHA-256 stay in the text test support.
