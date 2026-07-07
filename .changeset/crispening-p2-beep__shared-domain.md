---
"@beep/shared-domain": patch
---

Crispen `@beep/shared-domain` for the P2 repo-crispening wave: move shared-kernel absence/default handling into schemas, colocate codec statics on central primitives and unions, preserve LiteralKit member guards while adding decode statics, tighten shared token schemas, delegate LocalDate parsing/equality to schema-derived codecs/equivalence, and add encoded-shape plus `S.toArbitrary` parity laws. BaseEntity field key annotations are deferred as a documented descriptor-identity carve-out.
