# SKOS Profile Research

Access date: 2026-06-04

## Sources

- W3C SKOS Reference: https://www.w3.org/TR/skos-reference/
- `goals/ontology-modeling-foundation/SPEC.md`
- `packages/foundation/modeling/rdf`
- `packages/foundation/modeling/ontology`

## Answer To "What About SKOS?"

SKOS should be a first-class opt-in profile for `@beep/ontology`, not merely a
vocabulary constant dump.

The W3C SKOS Reference frames SKOS as a common RDF model for thesauri,
classification schemes, taxonomies, subject-heading systems, and other concept
schemes. That matches legal/OIP taxonomy browsing and RAG ingestion better than
starting with full OWL DL reasoning.

SKOS concepts can sit beside OWL/RDFS classes, but the distinction must stay
explicit. The roadmap should not silently reinterpret every current ontology
class as a SKOS concept.

## Current Repo State

`@beep/rdf` currently has generic vocab modules for OA, OWL, PROV, RDF, RDFS,
and XSD. It has no `Vocab/Skos.ts`.

`@beep/ontology` currently has local SKOS constants for:

- namespace
- alt label
- definition
- exact match
- close match

Current JSON-LD and Turtle projections emit some SKOS fields, but there is no
profile model for concept schemes, preferred labels, hidden labels, broader and
narrower hierarchy, related links, mapping variants, top concepts, or
multilingual labels and notes.

## Recommended Boundary

Generic SKOS vocabulary constants:

- `@beep/rdf/Vocab/Skos`

Higher-level SKOS behavior:

- `@beep/ontology`

Existing SKOS-like constants inside `@beep/ontology`:

- cleanup-on-touch after `@beep/rdf/Vocab/Skos` exists

## V1 Profile Support

Support these SKOS terms in v1 profile metadata and projections:

- `skos:Concept`
- `skos:ConceptScheme`
- `skos:prefLabel`
- `skos:altLabel`
- `skos:hiddenLabel`
- `skos:definition`
- `skos:scopeNote`
- `skos:editorialNote`
- `skos:historyNote`
- `skos:broader`
- `skos:narrower`
- `skos:related`
- `skos:exactMatch`
- `skos:closeMatch`
- `skos:broadMatch`
- `skos:narrowMatch`
- `skos:relatedMatch`
- `skos:inScheme`
- `skos:hasTopConcept`
- `skos:topConceptOf`

Model labels and notes as language-aware values. Plain string fields stay as
compatibility and display fallback.

## Validation Recommendations

Hard errors:

- more than one `prefLabel` for the same language
- the same literal used across conflicting pref/alt/hidden label buckets for
  the same language
- malformed language tags if the profile introduces language tag validation

Warnings:

- hierarchy cycles
- `skos:related` used between direct broader/narrower neighbors
- missing display label
- missing concept scheme when publishing a browsable taxonomy
- authored transitive hierarchy links

Do not emit `skos:broaderTransitive` or `skos:narrowerTransitive` as authored
triples in v1. Treat transitive closure as future query/search support.

## Search And Display Ergonomics

Taxonomy browsers and RAG workflows need:

- stable IRI
- display label per preferred language
- fallback label when localized label is absent
- alternative labels for search recall
- hidden labels for misspellings, abbreviations, and internal codes
- definitions and notes for snippets
- broader/narrower path for browsing
- related and mapping links for expansion

## Deferred SKOS Scope

- SKOS-XL label resources
- ordered collections
- full reasoning over transitive relations
- external scheme alignment UI
- advanced provenance on individual label assertions
