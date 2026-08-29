# Ontology Interop Roadmap Plan

## Status

This plan executes [SPEC.md](./SPEC.md). Packet research is complete and the v1
package implementation is complete in the existing foundation modeling packages.

## Phase 0 - Packet And Research

- [x] Create `goals/ontology-interop-roadmap`.
- [x] Mirror the canonical `goals/_template` packet shape.
- [x] Inspect `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and
  `goals/README.md`.
- [x] Inspect `goals/ontology-modeling-foundation`.
- [x] Inspect live `@beep/rdf` and `@beep/ontology` source, exports, and tests.
- [x] Benchmark FOLIO browse/detail/export behavior.
- [x] Inventory relevant standards and format options.
- [x] Research SKOS profile behavior.
- [x] Research Effect v4 JSON Schema sidecar support.
- [x] Ground legal/OIP workflow fit from the baseline scratch and local corpus.
- [x] Resolve branch-closing grill decisions.

## Phase 1 - RDF Vocabulary Foundation

- [x] Add `@beep/rdf/Vocab/Skos` with generic SKOS constants.
- [x] Add focused tests for namespace and constant IRIs.
- [x] Update public exports and dtslint examples.
- [x] Move local SKOS constants out of `@beep/ontology` cleanup-on-touch.
- [ ] Consider a small `@beep/rdf/Vocab/Dcterms` follow-up if DCTERMS source
  constants remain local to `@beep/ontology`.

## Phase 2 - Ontology SKOS Profile

- [x] Add opt-in SKOS profile metadata models in `@beep/ontology`.
- [x] Preserve current class metadata compatibility fields.
- [x] Support multilingual labels and notes beside current plain string fields.
- [x] Allow dual `rdfs:Class` plus `skos:Concept` only when explicitly opted in.
- [x] Implement profile validation with hard errors and warnings.
- [x] Enrich JSON-LD and Turtle projections for profile fields.

## Phase 3 - Markdown Documentation Projection

- [x] Add deterministic Markdown projection in `@beep/ontology`.
- [x] Default to portable Markdown links.
- [x] Add explicit Obsidian wikilink mode for vault/RAG workflows.
- [x] Cover ontology, class/concept, predicate, scheme, hierarchy, mapping,
  source/provenance, and sidecar-pointer sections.
- [ ] Keep HTML pages, route suffixes, and browsers out of v1 package scope.

## Phase 4 - JSON Schema Sidecars And Provenance

- [x] Derive `JsonSchema.Document<"draft-2020-12">` with
  `S.toJsonSchemaDocument(...)` from source class schemas.
- [x] Attach sidecars as non-RDF ontology metadata.
- [x] Use safe generation defaults and avoid broad annotation leakage.
- [x] Add optional domain-agnostic provenance hooks.
- [ ] Keep legal/OIP provenance requirements in future ingestion/product slices.

## Phase 5 - Focused Verification

- [x] Run package type checks for `@beep/rdf` and `@beep/ontology`.
- [x] Run package tests for `@beep/rdf` and `@beep/ontology`.
- [x] Add or update dtslint examples for public surfaces.
- [x] Refresh repo export catalog only after package checks are green.
- [x] Escalate to broader repo quality lanes only if touched surfaces require it.

## Deferred Follow-Ups

- RDF/XML and OWL XML projection/import.
- OWL functional syntax and OWL profile modeling.
- TriG and N-Quads once named graph provenance is real.
- Full SHACL validators and reasoners in `@beep/semantic-web`.
- FOLIO-style HTML pages, API suffix routes, and visual browser UI.
- OBO bridges for non-OIP ontology ecosystems.
