---
"@beep/rdf-canonize": patch
---

Crispen `@beep/rdf-canonize` for the P2 repo-crispening wave: route RDF term adapter dispatch through schema-derived match helpers, make ambient `rdf-canonize` term conversion exhaustive with Effect matchers, dispatch canonicalization algorithms through the existing LiteralKit, and add lexical canonicalization encoded-shape parity coverage while preserving exported signatures and wire shapes.
