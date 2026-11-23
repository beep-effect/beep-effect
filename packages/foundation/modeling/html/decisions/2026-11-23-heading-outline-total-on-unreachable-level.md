---
title: The heading outline keeps an empty failure branch for a computed level that cannot fail on schema-valid input
date: 2026-11-23
reversal: Replace the Result.match in collectHeadingOutline with a direct decode once foreign callers can no longer pass a node that bypasses the root schema and the HeadingOffset guard.
governs:
  - src/internal/conformance/Html.heading-conformance.ts#collectHeadingOutline
enforcedBy: []
---

A schema-valid root and the HeadingOffset guard make the computed-heading-level decode failure unreachable.
The failure branch still returns an empty outline so outline inspection stays total for defensive foreign calls that skip the root schema.
It is a direct `A.emptyReadonly` reference, so the branch adds no function that coverage would count as unreached.
Rejected: a named thunk for the branch, which adds a function that no test can reach and drops the file below full function coverage.
