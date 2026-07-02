# Ontology Modeling Foundation Specification

## Status

**SUPERSEDED / reference only** — superseded by
[`explorations/identity-as-iri`](../../explorations/identity-as-iri). Do not
implement from this SPEC.

## Mission

Create a small foundation modeling stack for schema-backed ontology authoring:
Effect Schema classes remain the source of truth, ontology metadata is stored in
custom schema annotations, and projections are derived from assembled annotated
schemas.

## Package Boundary

### `@beep/rdf`

`@beep/rdf` owns pure RDF and linked-data value models:

- IRI and URI schemas
- RDF/JS-style terms, quads, datasets, and namespace bindings
- JSON-LD document primitives
- common RDF, RDFS, OWL, XSD, OA, and PROV vocabularies

It must not own ontology authoring policy, legal ontology concepts, service
Layers, external fetchers, or driver behavior.

### `@beep/ontology`

`@beep/ontology` owns ontology authoring over Effect Schema:

- ontology metadata schema models
- authoring drafts stored in `ontologyMetadata` annotations
- identity wrapper helpers for root and key annotations
- relationship reference normalization and resolution
- assembly from annotated schemas
- JSON-LD context/document projection and import
- Turtle projection for review and interoperability

It depends on `@beep/rdf` for RDF value safety and vocabularies.

### `@beep/semantic-web`

`@beep/semantic-web` remains a capability package. Existing pure RDF modules may
be compatibility re-exports from `@beep/rdf`, while future active semantic-web
capabilities can live here without forcing ontology authoring into the same
package.

## Authoring Contract

> **DEAD PRIOR ART.** The `Ontology.create(...)` authoring API below is
> retained only as prior-art context. It is replaced by composer-derived
> `$I.key` / `$I.class` / `$I.ontology`
> ([`explorations/identity-as-iri`](../../explorations/identity-as-iri)); the
> handoff explicitly kills `Ontology.create`, `createOntologyIdentity`, the
> reference synonym set, and runtime draft sniffing.

The public POC syntax is:

```ts
import { Ontology } from "@beep/ontology"
import { $OntologyId } from "@beep/identity/packages"

const { Ont, $I } = Ontology.create({
  identity: $OntologyId.create("example-ontology"),
  baseIri: "https://example.org/ontology#",
  preferredPrefix: "ex",
  label: "Example Ontology"
})
```

Classes use `S.Class(..., $I.annote("Name", Ont.class(...)))`. Fields use
`schema.pipe($I.annoteKey("Class.field", Ont.dataPredicate(...)))` or
`Ont.objectPredicate(...)`.

Relationship fields accept schema references where possible:

```ts
sameAs: [Ont.sameAs(ExternalActor)]
parents: [Ont.parent(Agent)]
equivalentClasses: [Ont.equivalentClass(FolioActor)]
```

The builder resolves schema references only when those schemas are included in
the same `Ont.build([...])` call.

## Annotation Contract

`@beep/ontology` augments `effect/Schema` annotations with:

```ts
ontologyMetadata?: OntologyMetadataAnnotationPayload
```

Root annotations store ontology class drafts. Key annotations store predicate
drafts. Assembly retrieves both via Effect Schema annotation APIs and fails with
a typed `OntologyAssemblyError` when required metadata is missing, malformed, or
unresolvable.

## Projection Contract

`Ont.build([Class1, Class2])` returns an `Effect` that yields an
`AssembledOntology`. Projections are pure once assembly has succeeded:

- `Ont.toJsonLD(assembled)`
- `Ont.fromJsonLD(document)`
- `projectJsonLdContext(assembled)`
- `projectTurtle(assembled)`

The JSON-LD round-trip must preserve assembled ontology metadata and predicate
relationships for the POC surface.

## Acceptance Criteria

- `@beep/rdf` and `@beep/ontology` are valid foundation/modeling workspaces.
- `@beep/semantic-web` compatibility imports keep compiling.
- Package examples import public package entrypoints only.
- Tests prove root and key schema annotations store ontology metadata.
- Tests prove schema references resolve for class relationships.
- Tests prove JSON-LD projection and import round-trip.
- Scratchpad TypeScript and empty Vitest wiring verification pass.
