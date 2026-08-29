# Standards And Format Inventory

Access date: 2026-06-04

## Sources

- JSON-LD 1.1: https://www.w3.org/TR/json-ld11/
- Turtle: https://www.w3.org/TR/turtle/
- TriG: https://www.w3.org/TR/trig/
- N-Triples: https://www.w3.org/TR/n-triples/
- N-Quads: https://www.w3.org/TR/n-quads/
- RDF/XML: https://www.w3.org/TR/rdf-syntax-grammar/
- OWL 2 Structural Specification and Functional Syntax:
  https://www.w3.org/TR/owl2-syntax/
- OWL 2 XML Serialization: https://www.w3.org/TR/owl2-xml-serialization/
- SKOS Reference: https://www.w3.org/TR/skos-reference/
- SHACL: https://www.w3.org/TR/shacl/
- CommonMark: https://spec.commonmark.org/0.31.2/
- OBO Format 1.4: https://owlcollab.github.io/oboformat/doc/GO.format.obo-1_4.html
- JSON Schema Draft 2020-12: https://json-schema.org/draft/2020-12

## Inventory

| Format | What it is for | Recommendation | Home | Risk |
| --- | --- | --- | --- | --- |
| JSON-LD | JSON-native linked-data interchange. | Keep core import/export. Enrich with SKOS profile fields. | `@beep/ontology` over `@beep/rdf` primitives. | Medium if full JSON-LD expansion/compaction is needed. |
| Turtle | Human-readable RDF graph syntax. | Keep core export. Consider import after parser dependency review. | Pure syntax utilities in `@beep/rdf`; ontology projection in `@beep/ontology`. | Low for export, medium for import. |
| Markdown | Human-readable documentation projection for docs, vaults, and RAG. | Support v1 as export/projection only. | `@beep/ontology`. | Low-medium: escaping, anchor stability, link modes. |
| SKOS | RDF vocabulary and model for concept schemes, taxonomies, thesauri. | Support v1 as first-class opt-in profile. | Constants in `@beep/rdf`; behavior in `@beep/ontology`. | Medium: multilingual labels, validation, open-world semantics. |
| N-Triples | Line-based RDF graph syntax. | Optional early debug/fixture export after v1 spine; not required. | `@beep/rdf`. | Low. |
| TriG | RDF dataset syntax with named graphs. | Defer until named graph provenance is required. | `@beep/rdf` dataset syntax. | Medium: graph identity policy. |
| N-Quads | Line-based RDF dataset syntax. | Defer with TriG. | `@beep/rdf`. | Low-medium: dataset semantics. |
| RDF/XML | XML syntax for RDF graphs. | Defer v1. Useful for legacy tool compatibility only. | Future parser/serializer in `@beep/rdf`, surfaced by `@beep/ontology`. | High: XML security, serializer correctness, poor ergonomics. |
| OWL functional syntax | OWL ontology syntax for axioms and profiles. | Defer until model supports real OWL axioms. | Future `@beep/ontology` subdomain or new modeling package if justified. | High: structural model and profile semantics. |
| OWL XML | XML serialization for OWL 2 structural syntax. | Defer. Do not treat FOLIO XML as mandatory parity. | Future OWL-specific modeling surface. | High. |
| SHACL | Shapes Constraint Language for RDF graph validation. | Defer full validator. Consider shape generation only after SKOS/docs/schema sidecars. | Runtime validation in `@beep/semantic-web`; generated shapes may start in `@beep/ontology`. | Medium-high: closed-world mismatch and engine dependencies. |
| OBO | Biomedical ontology text format with OWL mapping. | Out of v1 scope. Revisit only for OBO corpus needs. | Future importer/bridge package. | High: niche ecosystem and mapping complexity. |
| JSON Schema | JSON instance shape documentation and validation. | Support as non-RDF sidecar via Effect Schema. | `@beep/ontology` sidecar metadata. | Medium: codec representation and annotation filtering. |

## Ranked Support Decision

Support in v1:

1. JSON-LD enrichment
2. Turtle enrichment
3. Markdown projection
4. SKOS profile behavior
5. JSON Schema sidecars

Consider after v1:

1. N-Triples export for fixtures and debugging
2. Turtle import if parser dependency is acceptable
3. SHACL shape generation from profile/schema metadata

Defer explicitly:

1. RDF/XML
2. OWL XML
3. OWL functional syntax
4. TriG and N-Quads
5. full SHACL validators
6. OBO import/export

## Package Boundary Notes

Concrete RDF syntaxes belong in `@beep/rdf` when they are pure parsers or
serializers over RDF values. Ontology projections can call those utilities from
`@beep/ontology`. Runtime validators, reasoners, fetchers, external graph
stores, and service Layers belong in `@beep/semantic-web` or future capability
packages.
