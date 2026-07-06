---
"@beep/ontology": patch
---

Crispen `@beep/ontology` (P2 repo-crispening-orchestration): collapse the redundant
search-score numeric union to `S.Finite`, absorb URL and FOLIO IRI-token precision
checks into the production schemas without changing encoded wire shapes, and add
`S.toArbitrary` round-trip plus representative OpenAPI wire-shape parity laws for
the ontology models.
