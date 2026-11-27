---
title: Typed-array fills and graphology population stay imperative loops
date: 2026-11-26
reversal: Rewrite the while loops in generateSyntheticOntologyProjection (src/Cosmos.projection.ts) and populateGraph (src/Cosmos.renderer.ts) with collection combinators once the 100k-node benchmark no longer needs these hot paths.
governs:
  - src/Cosmos.projection.ts#generateSyntheticOntologyProjection
  - src/Cosmos.renderer.ts#renderWithSigma
enforcedBy: []
---

The synthetic projection fills its typed arrays, and the sigma backend populates graphology, with index-driven while loops.
Reason: on the 100k-node benchmark path the loops allocate no intermediate index arrays, and graphology's adapter API is mutating, so a combinator pipeline would only build arrays to feed it.
Rejected: schema-derived collection combinators, which allocate an intermediate array per pass on that path.
