# Roadmap Synthesis

Access date: 2026-06-04

## Current Capabilities

`@beep/rdf` currently provides RDF-safe values, IRI/URI schemas, JSON-LD value
models, semantic schema metadata, and common OA/OWL/PROV/RDF/RDFS/XSD
vocabularies.

`@beep/ontology` currently provides Effect Schema annotation authoring,
assembly, bounded JSON-LD projection/import, and Turtle projection.

`@beep/semantic-web` currently remains the foundation/capability home for
bounded SHACL-style runtime validation and compatibility re-exports.

## Missing Capabilities

High-value gaps:

- generic SKOS constants in `@beep/rdf`
- opt-in SKOS concept/scheme profile in `@beep/ontology`
- multilingual labels and notes
- hidden labels and browser/search metadata
- Markdown docs projection with portable and Obsidian link modes
- JSON Schema sidecars from Effect Schema
- richer provenance metadata hooks

Lower-priority gaps:

- N-Triples export
- Turtle import
- SHACL shape generation

Deferred gaps:

- RDF/XML and OWL XML
- OWL functional syntax
- TriG and N-Quads
- full SHACL engines and reasoners
- OBO bridges
- HTML browsers and route suffixes

## Recommended V1 Scope

1. Add `@beep/rdf/Vocab/Skos`.
2. Add opt-in SKOS profile metadata in `@beep/ontology`.
3. Preserve current class fields and add multilingual/profile fields beside
   them.
4. Enrich JSON-LD and Turtle projections for SKOS fields.
5. Add deterministic Markdown projection.
6. Support portable Markdown links by default and explicit Obsidian wikilinks
   for vault/RAG workflows.
7. Attach Effect Draft 2020-12 JSON Schema documents as non-RDF sidecars.
8. Add optional domain-agnostic provenance hooks.

## Package Boundary Recommendations

- `@beep/rdf`: generic vocab constants and pure RDF value/syntax utilities.
- `@beep/ontology`: schema-backed authoring, profile behavior, projections,
  Markdown docs, sidecars, and profile validation.
- `@beep/semantic-web`: runtime validation, reasoners, external graph engines,
  and future heavier semantic-web capability work.

No canonical architecture doc update is needed. Existing foundation/modeling
and foundation/capability doctrine already covers the target boundary.

## Proposed Implementation Sequence

1. RDF SKOS vocabulary constants and tests.
2. Ontology SKOS profile models and validation result shape.
3. Assembly integration and compatibility preservation.
4. JSON-LD/Turtle profile projection enrichment.
5. Markdown projection with dual link mode.
6. JSON Schema sidecars.
7. Provenance hooks.
8. Focused package checks, tests, dtslint, and export catalog refresh.

## Resolved Grill Decisions

- Package home: use existing `@beep/rdf` and `@beep/ontology`; do not create a
  new package for v1.
- V1 spine: SKOS profile, Markdown docs, JSON-LD/Turtle enrichment, JSON Schema
  sidecars, and provenance hooks.
- Documentation projection: Markdown only in `@beep/ontology`; HTML/server
  route suffixes are deferred.
- Markdown links: portable Markdown default plus explicit Obsidian wikilink
  mode.
- SKOS shape: opt-in profile beside the current class model.
- Validation severity: hard errors for core SKOS invariants and warnings for
  hierarchy/search ergonomics.
- JSON Schema metadata: sidecar only, not RDF projection by default.
- Provenance: domain-agnostic hooks in foundation modeling, legal requirements
  in future product/ingestion layers.

## Future Follow-Up Questions

These are not blockers for v1 packet execution:

- Should N-Triples export become part of the same implementation PR or a
  follow-up fixture/debug PR?
- Should DCTERMS constants move to `@beep/rdf/Vocab/Dcterms` with SKOS or in a
  cleanup follow-up?
- Which future app/server package should own FOLIO-style route suffixes and
  HTML taxonomy browsing?
