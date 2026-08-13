---
"@beep/semantic-web": minor
---

Remove the unconsumed JSON-LD service/adapter surface and the provenance
projection service from `@beep/semantic-web`. None of these had a consumer
outside the package's own tests; the package now exposes only its proven
contracts (SPARQL query, SHACL validation, canonicalization) plus the IRI/URI
schemas and compatibility shims.
