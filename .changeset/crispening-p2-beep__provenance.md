---
"@beep/provenance": patch
---

Crispen `@beep/provenance` for P2: annotate the reusable `TextAnchorFields`
keys, colocate the well-orderedness predicate on `TextAnchor` while preserving
the public `isWellOrdered` alias, and add schema-derived parity tests. The
encoded wire shape and public helper signature are unchanged; schema-level
cross-field enforcement is deferred to the family-close consumer sweep because
`TextAnchorFields` is spread outside this package.
