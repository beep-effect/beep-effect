---
title: Canonical attribute kernels run on the installation's captured Clock
date: 2026-11-23
reversal: Build the unicode, correction and year kernels in makeCitationCanonicalAttributeAssertion without providing the installation context, so they read the default Clock.
governs:
  - test/CitationCanonicalAttributes.fixtures.ts#makeCitationCanonicalAttributeAssertion
enforcedBy: []
---

Every kernel that `makeCitationCanonicalAttributeAssertion` builds captures the installation's Clock, as the engine's own stage owners do.

Reason: on the default Clock the year kernel's 997 ms `extractDeadline` (from `getMetadataYear`) ran in real time and failed hosted replays (PR #3013, lps-int-12). On the installation's manual clock that wait never fires, because these assertions run after `engine.extract`.

Rejected: the default Clock for the kernels.

Accepted limit: a hung kernel here is bounded only by the Vitest timeout. `test/CitationMetadataYear.test.ts` keeps the `extractDeadline` expiry coverage.
