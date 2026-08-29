# Ontology Interop Roadmap Specification

## Status

**ACTIVE**

## Mission

Define the next foundation-modeling roadmap for ontology interoperability after
the `@beep/rdf` and `@beep/ontology` POC. The roadmap turns the current
JSON-LD/Turtle ontology builder into a practical interop foundation for SKOS
taxonomies, Markdown documentation, API/RAG data-shape sidecars, and
domain-agnostic provenance metadata.

## Source Hierarchy

1. User objective for `goals/ontology-interop-roadmap`.
2. `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`, and
   `goals/README.md`.
3. `goals/ontology-modeling-foundation`.
4. Live source in `packages/foundation/modeling/rdf` and
   `packages/foundation/modeling/ontology`.
5. Research artifacts in this packet.
6. Local legal/OIP corpus and public standards sources, with legal conclusions
   treated as draft research context only.

## Package Boundary

### `@beep/rdf`

Owns RDF-safe value models, common RDF vocabularies, and future pure RDF syntax
utilities. V1 should add generic SKOS vocabulary constants at
`@beep/rdf/Vocab/Skos`.

Recommended constants include:

- `SKOS_NAMESPACE`
- `SKOS_CONCEPT`
- `SKOS_CONCEPT_SCHEME`
- `SKOS_PREF_LABEL`
- `SKOS_ALT_LABEL`
- `SKOS_HIDDEN_LABEL`
- `SKOS_DEFINITION`
- `SKOS_SCOPE_NOTE`
- `SKOS_EDITORIAL_NOTE`
- `SKOS_HISTORY_NOTE`
- `SKOS_BROADER`
- `SKOS_NARROWER`
- `SKOS_RELATED`
- `SKOS_EXACT_MATCH`
- `SKOS_CLOSE_MATCH`
- `SKOS_BROAD_MATCH`
- `SKOS_NARROW_MATCH`
- `SKOS_RELATED_MATCH`
- `SKOS_IN_SCHEME`
- `SKOS_HAS_TOP_CONCEPT`
- `SKOS_TOP_CONCEPT_OF`

`@beep/rdf` must not own ontology authoring policy, legal/OIP concepts,
service Layers, external fetchers, or runtime validator engines.

### `@beep/ontology`

Owns ontology assembly over Effect Schema annotations and the higher-level
interop behavior:

- Opt-in SKOS concept/scheme profile metadata.
- JSON-LD and Turtle enrichment for SKOS profile fields.
- Deterministic Markdown documentation projection.
- Effect JSON Schema metadata sidecars.
- Domain-agnostic source/provenance metadata hooks.
- Profile validation errors and warnings.

`@beep/ontology` must preserve the existing RDFS/OWL-class POC behavior. A
node may be both `rdfs:Class` and `skos:Concept` only when SKOS profile
metadata explicitly opts into that behavior.

### `@beep/semantic-web`

Remains the foundation/capability package for runtime validation, bounded
SHACL services, reasoners, external graph engines, and compatibility exports.
The v1 roadmap must not move pure ontology authoring into this capability
package.

## V1 Scope

### SKOS Profile

Add a first-class opt-in SKOS profile in `@beep/ontology`.

The profile must support:

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
- multilingual labels and notes

Plain `label`, `comment`, `altLabels`, `definition`, `exactMatches`, and
`closeMatches` remain compatibility fields. Multilingual SKOS labels and notes
live beside them initially and provide richer display/search metadata.

Validation policy:

- Hard errors for duplicate `prefLabel` in the same language.
- Hard errors for the same literal in conflicting `prefLabel`, `altLabel`, and
  `hiddenLabel` buckets for the same language.
- Warnings for hierarchy cycles, `related` links that duplicate hierarchy, and
  search/display quality issues.
- Do not author `broaderTransitive` or `narrowerTransitive` triples by default;
  derive transitive closure later for search/query expansion if needed.

### Markdown Documentation Projection

Add Markdown-only documentation projection in `@beep/ontology`.

Requirements:

- Deterministic CommonMark-style output for ontology, class/concept, and
  predicate documentation.
- Portable Markdown links by default.
- Explicit Obsidian wikilink mode for vault/RAG workflows using a stable shape
  such as `[[iri-slug|Label]]`.
- Sections for IRI, labels, definitions, notes, scheme membership, hierarchy,
  mappings, predicates, source/provenance, and JSON Schema sidecar pointers.
- No HTML rendering, route suffixes, browser UI, or server endpoints in v1.

### Effect JSON Schema Sidecars

For each source class schema, derive Draft 2020-12 JSON Schema with
`S.toJsonSchemaDocument(...)` and attach it as non-RDF ontology metadata.

Default generation policy:

- `additionalProperties: false`
- `generateDescriptions: true`
- `includeAnnotationKey` must whitelist intentional custom keys such as `x-*`
  and must not use broad `() => true`.

Recommended sidecar shape:

- class IRI
- schema identity
- `JsonSchema.Document<"draft-2020-12">`
- optional generation options summary

JSON Schema sidecars document and validate JSON data shape for APIs, tooling,
editors, and RAG ingestion. They are not emitted into JSON-LD, Turtle, or RDF
triples by default.

### Provenance Hooks

Add domain-agnostic provenance metadata hooks. The shape should be optional and
usable outside legal/OIP work.

Recommended fields:

- source IRI or URI
- source label or citation
- source span or selector
- extraction method
- verification status
- updated timestamp

Legal/OIP workflows may require provenance in their own slice or ingestion
layer, but foundation modeling APIs should not make legal-specific provenance
mandatory for every generic ontology class.

## Deferred Scope

- RDF/XML and OWL XML import/export.
- OWL functional syntax and OWL DL profile modeling.
- TriG and N-Quads until named graph provenance is required.
- Full SHACL validation engine work.
- OBO import/export.
- HTML detail pages, API suffix routing, and visual taxonomy browsers.
- Legal-specific ontology package content.

## Acceptance Criteria For V1 Implementation

- `@beep/rdf/Vocab/Skos` exports generic SKOS constants through public package
  entrypoints and tests prove expected IRIs.
- `@beep/ontology` exposes opt-in SKOS profile models and assembly behavior
  without breaking existing JSON-LD/Turtle round-trip tests.
- JSON-LD and Turtle projections include SKOS profile fields when present.
- Markdown projection tests cover portable and Obsidian link modes.
- JSON Schema sidecar tests prove `S.toJsonSchemaDocument` output is attached
  outside RDF projections.
- Validation tests cover hard errors and warnings separately.
- Package-local imports in tests use public `@beep/*` aliases.
- Focused package checks for `@beep/rdf` and `@beep/ontology` pass before any
  broader repo quality lane.

## Stop Conditions

- Future implementation would require new package topology not covered by this
  packet.
- A standard source contradicts the intended semantics enough to require a
  doctrine update.
- Runtime validation, reasoner, browser, or server endpoint work becomes
  necessary to complete v1.
- Legal/OIP-specific content starts leaking into foundation modeling APIs.
