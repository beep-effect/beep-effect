# Current Surface And Gap Analysis

Access date: 2026-06-04

## Sources

- `goals/ontology-modeling-foundation/SPEC.md`
- `packages/foundation/modeling/rdf`
- `packages/foundation/modeling/ontology`
- `packages/foundation/capability/semantic-web`
- `standards/repo-exports.catalog.md`

## Current RDF Surface

`@beep/rdf` is a foundation/modeling package. It currently owns:

- `Iri.ts`
- `Uri.ts`
- `Rdf.ts`
- `JsonLd.ts`
- `SemanticSchemaMetadata.ts`
- `Vocab/Oa.ts`
- `Vocab/Owl.ts`
- `Vocab/Prov.ts`
- `Vocab/Rdf.ts`
- `Vocab/Rdfs.ts`
- `Vocab/Xsd.ts`

Confirmed vocabulary modules: OA, OWL, PROV, RDF, RDFS, and XSD.

Missing vocabulary modules relevant to this roadmap:

- `@beep/rdf/Vocab/Skos`
- `@beep/rdf/Vocab/Dcterms`

`SemanticSchemaMetadata.ts` includes representation labels for `RDF/JS`,
`JSON-LD`, `Turtle`, `TriG`, `RDF/XML`, and `JSON Schema`. These are metadata
labels, not proof that serializers or parsers exist for every representation.

## Current Ontology Surface

`@beep/ontology` is a foundation/modeling package. It currently owns:

- schema annotation models and readers
- typed ontology assembly errors
- authoring helpers through `Ontology.create(...)`
- class and predicate assembly from annotated Effect schemas
- JSON-LD context and ontology document projection
- bounded JSON-LD ontology parse/round-trip support
- Turtle export

Public exports include:

- `Ontology`
- metadata readers, guards, references, and errors
- `projectJsonLdContext`
- `projectJsonLdOntology`
- `parseJsonLdOntology`
- `projectTurtle`

Tests prove annotation storage, relationship resolution, JSON-LD projection,
bounded JSON-LD parse/round-trip, and Turtle projection.

## Current SKOS-Like Surface

`@beep/ontology/src/model.ts` currently defines local constants:

- `SKOS_NAMESPACE`
- `SKOS_ALT_LABEL`
- `SKOS_DEFINITION`
- `SKOS_EXACT_MATCH`
- `SKOS_CLOSE_MATCH`

JSON-LD and Turtle projections emit SKOS-ish class fields:

- `skos:altLabel`
- `skos:definition`
- `skos:exactMatch`
- `skos:closeMatch`

These are useful but not a first-class SKOS profile. They do not yet model
concept schemes, preferred labels, hidden labels, note variants, broader/narrower
relations, related links, mapping variants, top concepts, or multilingual label
and note records.

## Confirmed Gaps

Missing or not first-class today:

- `@beep/rdf/Vocab/Skos`
- JSON-LD/Turtle enrichment for complete SKOS profile fields
- Markdown documentation projection
- Obsidian wikilink projection mode
- RDF/XML projection or import
- OWL XML or OWL functional syntax projection/import
- Turtle import
- TriG, N-Triples, or N-Quads import/export
- SHACL profile generation or full SHACL validation in `@beep/ontology`
- Effect JSON Schema sidecar metadata on assembled ontology output
- domain-agnostic source/provenance record beyond the current simple source IRI

## Recommendations

1. Move generic SKOS constants into `@beep/rdf/Vocab/Skos`.
2. Treat current local SKOS constants in `@beep/ontology` as cleanup-on-touch.
3. Keep profile behavior in `@beep/ontology`, not `@beep/rdf`.
4. Add Markdown projection before XML/OWL parity.
5. Attach JSON Schema documents as non-RDF sidecars instead of stuffing Effect
   annotations into triples.
6. Reuse `@beep/semantic-web` for runtime validation concerns instead of adding
   validator engines to `@beep/ontology`.

## Risks

- Current class models are RDFS/OWL-oriented; SKOS must be opt-in to avoid
  silently changing meaning.
- Markdown helpers exist in other packages, but `@beep/ontology` should avoid
  capability dependencies for v1 and keep documentation projection pure.
- The generated export catalog is already dirty in the local checkout; future
  implementation should refresh it only after package checks are green.
