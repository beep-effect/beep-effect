---
"@beep/epistemic-use-cases": patch
---

Crispen `@beep/epistemic-use-cases` for the P2 repo-crispening wave: model the claim projection contract as a schema-backed `Fn`, drive projection counts and claim-gate assertions through schema-owned literal/tagged-union helpers, replace projection equality with schema-derived equivalence, and add encoded-shape plus `S.toArbitrary` parity coverage. Public projection behavior and encoded read-model shapes remain unchanged; imported-schema static-colocation ripples are deferred to the family-close sweep.
