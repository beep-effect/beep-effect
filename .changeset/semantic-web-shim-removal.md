---
"@beep/semantic-web": minor
"@beep/rdf": patch
"@beep/epistemic-use-cases": patch
---

Remove every compatibility re-export from `@beep/semantic-web` — the root
IRI/URI/JSON-LD model surface, `rdf`/`prov`/`evidence`/
`semantic-schema-metadata`, the `vocab/*` constants, and the Web Annotation
adapter shim. The package root now re-exports its three service contract
modules (SPARQL query, SHACL validation, canonicalization) and nothing else;
all model imports go to `@beep/rdf` directly. The model tests move to
`@beep/rdf`, which canonically owns those schemas.
