---
"@beep/identity": patch
"@beep/ontology": patch
"@beep/rdf": patch
---

Ship the identity-backed ontology fold: additive `$I.key`/`$I.class` composer
entrypoints (`ontologyTerm`/`skosClassification` channels), the predicate-open
`Ontology.fold` with SKOS integrity gate and pure JSON-LD/context/Turtle/
Markdown projections, idempotent FOLIO annotation migrations (borrowed
identifiers to `$I.key`, `parent_class_of` to `^rdfs:subClassOf`, legacy DC to
`dcterms:*`, MADS `country` vocab-less), the `vocab-terms` sync target
generating the shared-five vocabulary inventories from `CoreVocab`, and
deprecation annotations on the `SemanticSchemaMetadata` address fields.
